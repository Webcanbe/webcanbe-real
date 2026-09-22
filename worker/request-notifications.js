/** Notification boundary for request cases. Persistence is authoritative and
 * always completes before this seam is called. No provider is configured yet. */
export async function notifyRequestCreated(_env, _requestCase) {
  return Object.freeze({ state: "not_configured" })
}
