export declare class FirstPartyTemplateError extends Error {
  status: number
  constructor(status: number, message: string)
}
export declare function createFirstPartyTemplate(
  db: { query(sql: string, args?: unknown[]): Promise<{ rowCount: number; rows: any[] }> },
  session: { userId: string; sessionId: string; expiresAt: number },
  body: { slug: string; workspaceId: string; idempotencyKey: string },
  env: { ASSETS: { fetch(request: Request): Promise<Response> } },
): Promise<{ projectId: string; replayed: boolean }>
