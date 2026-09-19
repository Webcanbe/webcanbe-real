import { Client } from "pg"

export async function withHyperdrive(env, action) {
  const connectionString = env?.HYPERDRIVE?.connectionString
  if (typeof connectionString !== "string" || !connectionString) {
    const error = new Error("Product database is not configured.")
    error.code = "WCB_DATABASE_UNAVAILABLE"
    throw error
  }

  const client = new Client({ connectionString })
  await client.connect()
  try {
    return await action(client)
  } finally {
    await client.end().catch(() => {})
  }
}
