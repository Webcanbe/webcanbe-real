const iso = value => new Date(String(value)).toISOString()

function parseJson(value, fallback) {
  if (value === undefined || value === null) return structuredClone(fallback)
  if (typeof value === "string") return JSON.parse(value)
  return structuredClone(value)
}

function cleanTags(value) {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > 20 || value.some(tag => typeof tag !== "string")) throw new Error("Invalid listing tags.")
  return [...new Set(value.map(tag => tag.trim().toLowerCase()).filter(Boolean))].sort()
}

function publicListing(row) {
  const tags = parseJson(row.tags, [])
  const demoMetadata = parseJson(row.demo_metadata, {})
  const listing = {
    listingId: String(row.listing_id),
    catalogProjectId: String(row.catalog_project_id),
    releaseId: String(row.release_id),
    slug: String(row.slug),
    title: String(row.title),
    summary: String(row.summary),
    status: String(row.status),
    availability: String(row.availability),
    tags,
    demoMetadata,
    updatedAt: iso(row.updated_at),
    releaseVersion: String(row.version),
    sourceRevisionId: String(row.source_revision_id),
    snapshotHash: String(row.snapshot_hash),
  }
  if (row.qualification_status) {
    listing.ready = {
      status: String(row.qualification_status),
      version: String(row.qualification_version),
      compatibility: parseJson(row.compatibility_evidence, {}),
      reasons: parseJson(row.reasons, []),
    }
  }
  return Object.freeze(listing)
}

export async function browseCatalog(db, input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid catalog filter.")
  if (Object.keys(input).some(key => !["query","tags","limit"].includes(key))) throw new Error("Invalid catalog filter.")
  const query = input.query === undefined ? "" : String(input.query).trim().toLowerCase()
  if (input.query !== undefined && typeof input.query !== "string" || query.length > 100) throw new Error("Invalid catalog filter.")
  const tags = cleanTags(input.tags)
  const limit = input.limit === undefined ? 24 : input.limit
  if (!Number.isSafeInteger(limit)) throw new Error("Invalid catalog filter.")
  const bounded = Math.min(Math.max(limit, 1), 100)

  const result = await db.query(`SELECT l.*,r.version,r.source_revision_id,r.snapshot_hash,c.public_metadata,q.qualification_status,q.qualification_version,q.compatibility_evidence,q.reasons FROM wcb_listings l
    JOIN wcb_project_releases r ON r.release_id=l.release_id JOIN wcb_catalog_projects c ON c.catalog_project_id=l.catalog_project_id
    LEFT JOIN wcb_ready_qualifications q ON q.release_id=r.release_id
    WHERE l.status='published' AND l.availability='available' AND c.status='active' ORDER BY l.updated_at DESC`)
  return result.rows
    .map(publicListing)
    .filter(item => (!query || `${item.title} ${item.summary} ${item.slug} ${item.tags.join(" ")}`.toLowerCase().includes(query)) && tags.every(tag => item.tags.includes(tag)))
    .slice(0, bounded)
}

export async function catalogDetail(db, reference) {
  if (typeof reference !== "string" || !reference || reference.length > 100) throw new Error("Invalid listing reference.")
  const result = await db.query(`SELECT l.*,r.version,r.status AS release_status,r.source_project_id,r.source_revision_id,r.source_content_hash,r.snapshot_hash,r.created_at AS release_created_at,c.public_metadata,q.qualification_status,q.qualification_version,q.compatibility_evidence,q.reasons
    FROM wcb_listings l JOIN wcb_project_releases r ON r.release_id=l.release_id JOIN wcb_catalog_projects c ON c.catalog_project_id=l.catalog_project_id
    LEFT JOIN wcb_ready_qualifications q ON q.release_id=r.release_id
    WHERE (l.listing_id::text=$1 OR l.slug=$1) AND l.status='published' AND c.status='active'`, [reference])
  const row = result.rows[0]
  if (!row) return undefined
  return Object.freeze({
    ...publicListing(row),
    release: Object.freeze({
      releaseId: String(row.release_id),
      catalogProjectId: String(row.catalog_project_id),
      version: String(row.version),
      status: "published",
      sourceProjectId: String(row.source_project_id),
      sourceRevisionId: String(row.source_revision_id),
      sourceContentHash: String(row.source_content_hash),
      snapshotHash: String(row.snapshot_hash),
      createdAt: iso(row.release_created_at),
    }),
    publicMetadata: parseJson(row.public_metadata, {}),
  })
}
