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
  OPERATOR_POSTAL_ADDRESS: "256 Gaon-ro, Paju-si, Gyeonggi-do 10894, Republic of Korea (Korean: 경기도 파주시 가온로 256, 10894)",
  OPERATOR_REQUIRED_CONTACT_DETAILS: "Email: hello@webcanbe.com. Telephone in the Republic of Korea: 010-8167-8563. International telephone: +82 10-8167-8563.",
  OPERATOR_REGISTRATION_DISCLOSURE: "Business registration is currently pending. Do not claim a business registration number or mail-order-sales filing number that has not actually been issued.",
  SUPPORTED_CUSTOMER_TERRITORIES: "United States, Canada, United Kingdom, European Economic Area, Switzerland, Australia, New Zealand, Japan, Singapore, South Korea, Hong Kong, plus other jurisdictions where Webcanbe and its providers may lawfully provide service, excluding sanctioned, restricted, or unsupported jurisdictions",
  ACTIVE_DATA_DELETION_SCHEDULE: "Verified deletion requests have an operational target of completion within 30 days, except for records that must remain for legal, accounting, payment, fraud, security or dispute obligations. Requests are handled through the Privacy Requests process; Webcanbe does not claim that account deletion is automatic, and provider-managed deletion or backup lifecycles may continue for the periods disclosed below",
  AI_REQUEST_RETENTION_SCHEDULE: "The current implementation does not persist raw AI prompt text or transient selected-source input context after the request completes, which is shorter than the 30-day maximum target for any future Webcanbe-controlled temporary copy. Accepted project edits and revisions remain ordinary project data, while AI usage, reservation and outcome metadata remains account or transaction data. Cloudflare Workers AI does not store request content unless a separate storage service is deliberately used and does not use Customer Content for training or service improvement without explicit consent.",
  BACKUP_RETENTION_SCHEDULE: "Webcanbe does not currently operate a separate managed backup store, and the current Supabase Free plan does not include automatic daily database backups. If Webcanbe-managed backup copies are introduced, their deletion or overwrite target is 30 days. Provider-managed disaster-recovery copies follow the provider's verified lifecycle; for example, Firebase states that deleted Authentication data is removed from live and backup systems within 180 days. A specifically documented lawful hold may require longer retention; backups are not used to reactivate deleted accounts for ordinary purposes.",
  CAMPAIGN_RETENTION_SCHEDULE: "No optional PostHog analytics or durable campaign-attribution store is enabled in the current production configuration. If ordinary campaign or referral attribution data is collected for a published campaign, its retention target is 90 days unless a longer period is required for a specific legal or accounting purpose. Reward eligibility, claim, fraud-prevention and financial records are separate records and may be kept for their applicable obligation, including a documented dispute or legal-record requirement.",
  SECURITY_LOG_RETENTION_SCHEDULE: "The application does not maintain a general durable store of raw diagnostic logs. Any ordinary Webcanbe-controlled transient security or audit log that is retained has a 180-day target, with longer retention only for an active incident, fraud investigation, dispute or legal obligation. Relevant incident records are isolated and reviewed instead of retaining all raw logs indefinitely. Immutable control, release, publication, rights, payment, license and entitlement evidence is not treated as an ordinary raw log and remains with the underlying provenance or transaction record.",
  CLOUDFLARE_PROCESSING_DETAILS: "Cloudflare, Inc. provides the production global edge network, Workers, static-asset delivery, Hyperdrive and Workers AI. Ordinary HTTPS traffic is processed at Cloudflare data centers near the connecting user unless a separately configured regional service applies; Webcanbe has not configured a regional-services restriction. Cloudflare's current DPA permits processing by Cloudflare and listed subprocessors in the United States and other listed service locations, uses the applicable EU Standard Contractual Clauses and UK transfer addendum for restricted transfers, and limits retention to the earlier of agreement termination or when processing is no longer necessary for the service. Request and response content is ordinarily handled in memory unless caching or another storage product is used. Workers AI does not use Customer Content to train models or improve Cloudflare or third-party services without explicit consent and stores that content only when a separate storage service is deliberately used.",
  GOOGLE_FIREBASE_PROCESSING_DETAILS: "Google LLC provides Firebase Authentication for project webcanbe-b607e. Authentication is a United States-only Firebase service: credentials, provider identifiers, basic profile data and authentication metadata are sent by encrypted HTTPS when a person signs up, signs in, refreshes authentication or manages an account. Firebase retains the authentication account until Webcanbe initiates deletion; Firebase states that associated authentication data is then removed from live and backup systems within 180 days. Google and its listed subprocessors process under the applicable Firebase/Google service terms and Cloud Data Processing Addendum, including the applicable contractual transfer safeguards.",
  SUPABASE_PROCESSING_DETAILS: "Supabase, Inc. hosts production project kappcfofcobhudmeuzmt. The configured PostgreSQL host resolves to Amazon Web Services region ap-northeast-2 (Northeast Asia / Seoul), so the primary database is in the Republic of Korea and is reached by the Worker through Cloudflare Hyperdrive. The authenticated Supabase dashboard identifies the current organization plan as Free; Supabase does not include automatic database backups on that plan, so no provider daily-backup retention window is claimed. Supabase and its listed subprocessors may access data as necessary to host, secure and support the service, including support by Supabase Pte. Ltd.; its current DPA uses the applicable EU Standard Contractual Clauses and related transfer safeguards for transfers, including support and onward processing in the United States and Singapore. This project-region statement does not claim that every support or account operation remains in the Republic of Korea.",
  PAYPAL_PROCESSING_DETAILS: "PayPal payment processing is not enabled in the active production Worker: the safe production diagnostic reports that all PayPal client, secret, webhook and plan bindings are absent. No production checkout, subscription or refund data is therefore transferred to PayPal by Webcanbe at this time. The separately prepared Sandbox configuration is for non-production testing only and must not be described as Live. Before any Live activation, this disclosure must be updated for the verified merchant account and regional PayPal contracting entity. When enabled, PayPal receives checkout identity and contact data, amount, currency, order or subscription references and transaction events at checkout and through signed webhooks; PayPal acts as an independent controller for payment, fraud and legal-compliance functions, retains relationship data for the relationship plus the locally applicable period described in its regional privacy statement (generally 10 years unless law permits or requires longer), and accepts privacy requests through its Privacy Hub.",
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

const applyVerifiedFacts = text => text
  .replace(/Active account, workspace\s+While the account or workspace is used and needed to provide the\s+and source\s+service; after a verified deletion request or the end of a necessary\s+purpose, remove data without undue delay and within any shorter legal\s+deadline; the active-system deletion schedule is \[\[ACTIVE_DATA_DELETION_SCHEDULE\]\]\./g, `Active account, workspace and source — While the account or workspace is used and needed to provide the service. ${verifiedFacts.ACTIVE_DATA_DELETION_SCHEDULE}.`)
  .replace(/Recoverable backups\s+Deleted content ages out under\s+\[\[BACKUP_RETENTION_SCHEDULE\]\],\s+except for a specifically documented lawful hold; backups are not used to\s+reactivate deleted accounts for ordinary purposes\./g, `Recoverable backups — ${verifiedFacts.BACKUP_RETENTION_SCHEDULE}`)
  .replace(/Routine raw security and\s+Retain under\s+\[\[SECURITY_LOG_RETENTION_SCHEDULE\]\]; isolate\s+diagnostic logs\s+records needed for a specific incident or claim and review retention rather\s+than retain all logs indefinitely\./g, `Routine raw security and diagnostic logs — ${verifiedFacts.SECURITY_LOG_RETENTION_SCHEDULE}`)
  .replace(/AI request results\s+Retain prompts, proposal outcomes and usage evidence under\s+\[\[AI_REQUEST_RETENTION_SCHEDULE\]\] for the product, accounting, and recovery\s+purposes identified there\. Accepted edits form part of project history\.\s+Provider-side retention is stated separately\./g, `AI request results — ${verifiedFacts.AI_REQUEST_RETENTION_SCHEDULE}`)
  .replace(/Contracts, payment and\s+Keep the minimum records for the applicable statutory period\. Where\s+supply records\s+Korean electronic-commerce record rules apply, contract\/cancellation and\s+payment\/supply records are generally retained for five years\./g, "Contracts, payment and supply records — Keep the minimum records for the applicable statutory period. Where Korean electronic-commerce record rules apply, contract/cancellation and payment/supply records are generally retained for five years.")
  .replace(/Consumer complaints and\s+Where Korean electronic-commerce record rules apply, generally three\s+disputes\s+years; retain a particular unresolved claim longer only on a documented\s+legal basis\./g, "Consumer complaints and disputes — Where Korean electronic-commerce record rules apply, generally three years; retain a particular unresolved claim longer only on a documented legal basis.")
  .replace(/We\s+offer\s+enabled\s+services\s+in\s+the\s+territories\s+identified\s+in\s+\[\[SUPPORTED_CUSTOMER_TERRITORIES\]\]\./g, `We offer enabled services in: ${verifiedFacts.SUPPORTED_CUSTOMER_TERRITORIES}.`)
  .replace(/records follow\s+\[\[CAMPAIGN_RETENTION_SCHEDULE\]\], with a limited, documented exception for\s+disputes or legal records\./g, `records follow this schedule: ${verifiedFacts.CAMPAIGN_RETENTION_SCHEDULE}`)
  .replace(/\[\[([A-Z0-9_\s]+)\]\]/g, (match, field) => verifiedFacts[field.replace(/\s+/g, "")] ?? match)
  .replace("We use PostHog for optional product analytics", "If enabled after a verified Webcanbe project token and host are configured, PostHog will provide optional product analytics")
  .replace("Our launch configuration is event-based analytics with session replay disabled.", "PostHog is disabled in the current launch configuration, and session replay is disabled in code.")
  .replace(/(?<!\.)\.\.(?!\.)/g, ".")
  .replace("issued.; Email:", "issued. Contact details: Email:")
  .replace("Category Retention approach", "Category — retention approach")
  .replace("Advertising records Where", "Advertising records — Where")
  .replace("License and rights evidence Keep", "License and rights evidence — Keep")
  .replace(/Republic of Korea \(Korean: ([^)]+)\), Republic of Korea/g, "Republic of Korea (Korean: $1)")

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
  const publicationBlocked = unresolvedFields.length > 0
  return {
    title,
    intro: publicationBlocked
      ? `${title} review draft dated 23 September 2026. It is not effective until the operator and processing details listed in the publication gate are verified.`
      : `${title}. Effective 23 September 2026.`,
    version: publicationBlocked ? "2026-09-23-review-3" : "2026-09-23",
    publicationBlocked,
    unresolvedFields,
    sections,
  }
}

const output = Object.fromEntries(sources.map(([file, route, title]) => [route, page(file, route, title)]))
fs.writeFileSync(outputFile, `${JSON.stringify(output, null, 2)}\n`)
