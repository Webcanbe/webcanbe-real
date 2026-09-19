export function requestId() {
  return crypto.randomUUID()
}

export function withRequestId(response, id) {
  const headers = new Headers(response.headers)
  headers.set("X-Request-ID", id)
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

export function safeFailureLog(event) {
  const value = event && typeof event === "object" ? event : {}
  const entry = {
    level: "error",
    event: typeof value.event === "string" ? value.event.slice(0, 80) : "worker_failure",
    requestId: typeof value.requestId === "string" ? value.requestId.slice(0, 80) : "",
    path: typeof value.path === "string" ? value.path.slice(0, 200) : "",
    status: Number.isInteger(value.status) ? value.status : 500,
  }
  console.error(JSON.stringify(entry))
}
