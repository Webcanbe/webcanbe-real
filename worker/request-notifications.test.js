import { expect, it } from "vitest"
import { notifyRequestCreated } from "./request-notifications.js"

it("reports the truthful notification state when no provider is configured",async()=>{
  await expect(notifyRequestCreated({}, {requestNumber:"WCB-REQ-ABC234"})).resolves.toEqual({state:"not_configured"})
})
