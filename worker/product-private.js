const iso = value => new Date(String(value)).toISOString()

function entitlement(row) {
  return Object.freeze({
    entitlementId: String(row.entitlement_id),
    userId: String(row.user_id),
    releaseId: String(row.release_id),
    provider: String(row.provider),
    providerReference: String(row.provider_reference),
    status: String(row.status),
    grantedAt: iso(row.granted_at),
    ...(row.revoked_at ? { revokedAt: iso(row.revoked_at) } : {}),
  })
}

function workspaceProject(row) {
  return Object.freeze({
    workspaceProjectId: String(row.workspace_project_id),
    workspaceId: String(row.workspace_id),
    entitlementId: String(row.entitlement_id),
    releaseId: String(row.release_id),
    sourceProjectId: String(row.source_project_id),
    sourceRevisionId: String(row.source_revision_id),
    sourceContentHash: String(row.source_content_hash),
    releaseSnapshotHash: String(row.snapshot_hash),
    createdAt: iso(row.created_at),
  })
}

export async function databasePurchases(db, session) {
  const result = await db.query(
    "SELECT * FROM wcb_license_entitlements WHERE user_id=$1 ORDER BY granted_at DESC LIMIT 200",
    [session.userId],
  )
  return result.rows.map(entitlement)
}

export async function databaseWorkspaceProjects(db, session) {
  const result = await db.query(
    `SELECT m.workspace_project_id,m.workspace_id,m.entitlement_id,m.created_at,
            e.release_id,r.source_project_id,r.source_revision_id,r.source_content_hash,r.snapshot_hash
       FROM wcb_entitlement_materializations m
       JOIN wcb_license_entitlements e ON e.entitlement_id=m.entitlement_id
       JOIN wcb_project_releases r ON r.release_id=e.release_id
      WHERE m.user_id=$1
        AND m.status='ready'
        AND EXISTS(
          SELECT 1 FROM wcb_workspace_members wm
           WHERE wm.workspace_id=m.workspace_id
             AND wm.user_id=$1
             AND wm.active
             AND wm.role IN ('owner','editor')
        )
      ORDER BY m.updated_at DESC
      LIMIT 100`,
    [session.userId],
  )
  return result.rows.map(workspaceProject)
}
