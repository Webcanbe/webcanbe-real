import fs from "node:fs"
import path from "node:path"
import { createHash } from "node:crypto"
import { fileURLToPath } from "node:url"

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
const VERSION = /^[A-Za-z0-9._-]{1,40}$/
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const FIXTURE_ROOT = path.join(ROOT, "fixtures", "studio-ledger")
const CREATED_AT = "2026-09-20T00:00:00.000Z"

const sha256 = value => createHash("sha256").update(value).digest("hex")
const slash = value => value.split(path.sep).join("/")

function deterministicUuid(seed) {
  const hex = sha256("webcanbe-launch-smoke:" + seed).slice(0, 32).split("")
  hex[12] = "5"
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16)
  const value = `${hex.slice(0,8).join("")}-${hex.slice(8,12).join("")}-${hex.slice(12,16).join("")}-${hex.slice(16,20).join("")}-${hex.slice(20,32).join("")}`
  if (!UUID.test(value)) throw new Error("Could not derive deterministic launch-smoke UUID.")
  return value
}

function walk(root, current = root, out = []) {
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const full = path.join(current, entry.name)
    const relative = slash(path.relative(root, full))
    if (entry.isDirectory()) {
      if (["node_modules", "dist", ".git", ".webcanbe"].includes(entry.name)) continue
      walk(root, full, out)
      continue
    }
    if (!entry.isFile()) continue
    if (/^\.env(?:$|\.)/i.test(entry.name) && entry.name !== ".env.example") continue
    out.push({ file: relative, bytes: fs.readFileSync(full) })
  }
  return out.sort((a,b)=>a.file.localeCompare(b.file))
}

function editableText(files) {
  const decoder = new TextDecoder("utf-8", { fatal: true })
  return files
    .filter(({file}) => file.startsWith("src/") && /\.(?:tsx?|jsx?|mts|cts|mjs|cjs|css|json)$/.test(file))
    .map(({file,bytes}) => [file, decoder.decode(bytes)])
    .sort(([a],[b]) => a.localeCompare(b))
}

function pgLiteral(value) {
  return "'" + String(value).replaceAll("'", "''") + "'"
}

export function buildMaterializationSmokeFixture({ userId, workspaceId, version = "v1" }) {
  if (!UUID.test(String(userId ?? ""))) throw new Error("WCB_SMOKE_USER_ID must be a UUID.")
  if (!UUID.test(String(workspaceId ?? ""))) throw new Error("WCB_SMOKE_WORKSPACE_ID must be a UUID.")
  if (!VERSION.test(String(version))) throw new Error("Smoke fixture version is invalid.")

  const seed = `${version}:${userId}:${workspaceId}`
  const sourceProjectId = deterministicUuid(seed + ":source")
  const catalogProjectId = deterministicUuid(seed + ":catalog")
  const releaseId = deterministicUuid(seed + ":release")
  const entitlementId = deterministicUuid(seed + ":entitlement")
  const revisionId = "rev_" + deterministicUuid(seed + ":revision")
  const files = walk(FIXTURE_ROOT)
  if (!files.length) throw new Error("Launch smoke fixture has no files.")

  const editable = editableText(files)
  if (!editable.length) throw new Error("Launch smoke fixture has no editable source.")
  const sourceContentHash = sha256(JSON.stringify(editable))
  const encodedFiles = files.map(({file,bytes}) => [file, bytes.toString("base64")])
  const history = {
    schema: 1,
    sourceScope: 2,
    sourceDirectory: "src",
    projectId: sourceProjectId,
    revisions: [{
      revisionId,
      projectId: sourceProjectId,
      parentRevisionId: null,
      createdAt: CREATED_AT,
      actor: userId,
      producer: "system",
      contentHash: sourceContentHash,
    }],
    transactions: [],
    past: [],
    future: [],
  }
  const snapshotHash = sha256(JSON.stringify({
    projectId: sourceProjectId,
    revisionId,
    contentHash: sourceContentHash,
    files: encodedFiles,
    history,
  }))
  const providerReference = `launch-smoke:${version}:${userId}`
  const slug = `__launch-smoke-${version.toLowerCase()}`
  const publicMetadata = {
    internal: true,
    purpose: "materialization-launch-smoke",
    fixture: "fixtures/studio-ledger",
    version,
  }

  const fixture = Object.freeze({
    version,
    sourceProjectId,
    catalogProjectId,
    releaseId,
    entitlementId,
    revisionId,
    sourceContentHash,
    snapshotHash,
    files: encodedFiles,
    history,
    provider: "launch-smoke",
    providerReference,
    slug,
    publicMetadata,
    fileCount: encodedFiles.length,
    editableFileCount: editable.length,
  })

  return fixture
}

export function materializationSmokeFixtureSql({ userId, workspaceId, version = "v1" }) {
  const f = buildMaterializationSmokeFixture({ userId, workspaceId, version })
  const files = pgLiteral(JSON.stringify(f.files))
  const history = pgLiteral(JSON.stringify(f.history))
  const metadata = pgLiteral(JSON.stringify(f.publicMetadata))
  const user = pgLiteral(userId)
  const workspace = pgLiteral(workspaceId)

  return `BEGIN;

-- Internal launch-smoke catalog provenance only. No wcb_listings row is created,
-- so this fixture is invisible to the public Marketplace.
INSERT INTO wcb_catalog_projects(
  catalog_project_id,source_project_id,owner_workspace_id,created_by,slug,title,summary,status,public_metadata,created_at
) VALUES(
  ${pgLiteral(f.catalogProjectId)}::uuid,${pgLiteral(f.sourceProjectId)}::uuid,${workspace}::uuid,${user}::uuid,
  ${pgLiteral(f.slug)},'Webcanbe materialization smoke fixture','Internal launch verification fixture.','active',
  ${metadata}::jsonb,clock_timestamp()
)
ON CONFLICT(catalog_project_id) DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS(
    SELECT 1 FROM wcb_catalog_projects
    WHERE catalog_project_id=${pgLiteral(f.catalogProjectId)}::uuid
      AND source_project_id=${pgLiteral(f.sourceProjectId)}::uuid
      AND owner_workspace_id=${workspace}::uuid
      AND created_by=${user}::uuid
      AND slug=${pgLiteral(f.slug)}
      AND public_metadata->>'purpose'='materialization-launch-smoke'
  ) THEN RAISE EXCEPTION 'Launch-smoke catalog provenance conflicts with existing data'; END IF;
END $$;

INSERT INTO wcb_project_releases(
  release_id,catalog_project_id,version,status,source_project_id,source_revision_id,
  source_content_hash,snapshot_hash,files,history,created_by,created_at
) VALUES(
  ${pgLiteral(f.releaseId)}::uuid,${pgLiteral(f.catalogProjectId)}::uuid,${pgLiteral("launch-smoke-" + f.version)},'published',
  ${pgLiteral(f.sourceProjectId)}::uuid,${pgLiteral(f.revisionId)},${pgLiteral(f.sourceContentHash)},${pgLiteral(f.snapshotHash)},
  ${files}::jsonb,${history}::jsonb,${user}::uuid,clock_timestamp()
)
ON CONFLICT(release_id) DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS(
    SELECT 1 FROM wcb_project_releases
    WHERE release_id=${pgLiteral(f.releaseId)}::uuid
      AND catalog_project_id=${pgLiteral(f.catalogProjectId)}::uuid
      AND status='published'
      AND source_project_id=${pgLiteral(f.sourceProjectId)}::uuid
      AND source_revision_id=${pgLiteral(f.revisionId)}
      AND source_content_hash=${pgLiteral(f.sourceContentHash)}
      AND snapshot_hash=${pgLiteral(f.snapshotHash)}
      AND created_by=${user}::uuid
  ) THEN RAISE EXCEPTION 'Launch-smoke immutable release conflicts with existing data'; END IF;
END $$;

INSERT INTO wcb_license_entitlements(
  entitlement_id,user_id,release_id,provider,provider_reference,status,granted_at
) VALUES(
  ${pgLiteral(f.entitlementId)}::uuid,${user}::uuid,${pgLiteral(f.releaseId)}::uuid,
  'launch-smoke',${pgLiteral(f.providerReference)},'active',clock_timestamp()
)
ON CONFLICT(entitlement_id) DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS(
    SELECT 1 FROM wcb_license_entitlements
    WHERE entitlement_id=${pgLiteral(f.entitlementId)}::uuid
      AND user_id=${user}::uuid
      AND release_id=${pgLiteral(f.releaseId)}::uuid
      AND provider='launch-smoke'
      AND provider_reference=${pgLiteral(f.providerReference)}
      AND status='active'
  ) THEN RAISE EXCEPTION 'Launch-smoke entitlement conflicts with existing data'; END IF;
END $$;

COMMIT;
`
}

function cli() {
  const userId = process.env.WCB_SMOKE_USER_ID
  const workspaceId = process.env.WCB_SMOKE_WORKSPACE_ID
  const version = process.env.WCB_SMOKE_FIXTURE_VERSION || "v1"
  const fixture = buildMaterializationSmokeFixture({ userId, workspaceId, version })
  if (process.argv.includes("--sql")) {
    process.stdout.write(materializationSmokeFixtureSql({ userId, workspaceId, version }))
    return
  }
  process.stdout.write(JSON.stringify({
    version: fixture.version,
    catalogProjectId: fixture.catalogProjectId,
    releaseId: fixture.releaseId,
    entitlementId: fixture.entitlementId,
    sourceContentHash: fixture.sourceContentHash,
    snapshotHash: fixture.snapshotHash,
    fileCount: fixture.fileCount,
    editableFileCount: fixture.editableFileCount,
    publicListingCreated: false,
  }, null, 2) + "\n")
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) cli()
