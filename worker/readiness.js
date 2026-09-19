const REQUIRED_TABLES = Object.freeze([
  "wcb_sessions",
  "wcb_identity_accounts",
  "wcb_workspace_members",
  "wcb_user_profiles",
  "wcb_catalog_projects",
  "wcb_project_releases",
  "wcb_listings",
  "wcb_license_entitlements",
  "wcb_entitlement_materializations",
])

export async function databaseReadiness(db) {
  const result = await db.query(
    `SELECT
      to_regclass('public.wcb_sessions') IS NOT NULL AS sessions,
      to_regclass('public.wcb_identity_accounts') IS NOT NULL AS identities,
      to_regclass('public.wcb_workspace_members') IS NOT NULL AS workspaces,
      to_regclass('public.wcb_user_profiles') IS NOT NULL AS profiles,
      to_regclass('public.wcb_catalog_projects') IS NOT NULL AS catalogs,
      to_regclass('public.wcb_project_releases') IS NOT NULL AS releases,
      to_regclass('public.wcb_listings') IS NOT NULL AS listings,
      to_regclass('public.wcb_license_entitlements') IS NOT NULL AS entitlements,
      to_regclass('public.wcb_entitlement_materializations') IS NOT NULL AS materializations`,
  )

  const row = result.rows[0] ?? {}
  const flags = [
    row.sessions,
    row.identities,
    row.workspaces,
    row.profiles,
    row.catalogs,
    row.releases,
    row.listings,
    row.entitlements,
    row.materializations,
  ]
  const readyCount = flags.filter(Boolean).length

  return Object.freeze({
    ok: readyCount === REQUIRED_TABLES.length,
    requiredCount: REQUIRED_TABLES.length,
    readyCount,
  })
}
