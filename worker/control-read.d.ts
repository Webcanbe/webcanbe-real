export type ControlSession = Readonly<{ userId: string }>
export type ControlAuthority = Readonly<{ role: "reviewer" | "admin" | "bigperson"; epoch: number }>
export type ControlReadResult = Readonly<{
  authority: ControlAuthority
  sellerApplications: Array<Record<string, unknown>>
  submissions: Array<Record<string, unknown>>
  reviews: Array<Record<string, unknown>>
  assessments: Array<Record<string, unknown>>
  results: Array<Record<string, unknown>>
  releases: Array<Record<string, unknown>>
  listings: Array<Record<string, unknown>>
  ready: Array<Record<string, unknown>>
  deployIntents: Array<Record<string, unknown>>
  users: Array<Record<string, unknown>>
  sessions: Array<Record<string, unknown>>
  workspaces: Array<Record<string, unknown>>
  operators: Array<Record<string, unknown>>
  entitlements: Array<Record<string, unknown>>
  audit: Array<Record<string, unknown>>
}>
export function databaseControlRead(db: { query(text: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }> }, session: ControlSession): Promise<ControlReadResult | undefined>
