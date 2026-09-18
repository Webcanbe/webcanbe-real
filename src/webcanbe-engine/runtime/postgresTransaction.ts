import type { Pool, PoolClient } from "pg"
export async function pgTransaction<T>(pool: Pool, action: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    await client.query("SET LOCAL statement_timeout='15s'; SET LOCAL lock_timeout='5s'; SET LOCAL idle_in_transaction_session_timeout='20s'")
    const result = await action(client)
    await client.query("COMMIT"); return result
  } catch (error) { await client.query("ROLLBACK").catch(() => {}); throw error }
  finally { client.release() }
}
