from pathlib import Path

controller_path = Path("src/webcanbe-engine/runtime/hostedProductController.ts")
controller = controller_path.read_text()
start_marker = '      if (action === "/seller/applications/transition") {'
end_marker = '      if (action === "/seller/submissions/create") {'
start = controller.find(start_marker)
end = controller.find(end_marker, start)
if start < 0 or end < 0 or end <= start:
    raise SystemExit("seller transition route boundary missing")
block = controller[start:end]
if "controlTransitionSellerApplication" not in block or "stepUpEvidenceId" not in block:
    raise SystemExit("unexpected seller transition checkpoint")
replacement = '''      if (action === "/seller/applications/transition") {
        exact(body, ["applicationId", "status"]); const status = text(body, "status")
        if (!["approved", "rejected"].includes(status)) throw new Error("Invalid seller application state.")
        return send(200, { application: await this.store.transitionSellerApplication(session, text(body, "applicationId"), status as "approved" | "rejected") })
      }
      if (action === "/control/seller-applications/transition") {
        exact(body, ["applicationId", "status", "stepUpEvidenceId", "idempotencyKey"]); const status = text(body, "status")
        if (!["approved", "rejected"].includes(status)) throw new Error("Invalid seller application state.")
        return send(200, { application: await this.store.controlTransitionSellerApplication(session, text(body, "stepUpEvidenceId"), text(body, "applicationId"), status as "approved" | "rejected", text(body, "idempotencyKey")) })
      }
'''
controller_path.write_text(controller[:start] + replacement + controller[end:])

test_path = Path("src/webcanbe-engine/phase3-hosted-product.test.ts")
tests = test_path.read_text()
marker = 'describe("Phase 3 Admin Control backend", () => {'
head, sep, tail = tests.partition(marker)
if not sep:
    raise SystemExit("Admin Control test section missing")
old_route = '"/seller/applications/transition"'
if old_route not in tail:
    raise SystemExit("Admin Control transition route references missing")
tail = tail.replace(old_route, '"/control/seller-applications/transition"')
tests = head + sep + tail
old_zip = '.split("async admitSellerZip", 2)[1].split("async sellerSubmissions", 1)[0]'
new_zip = '.split("async admitSellerZip", 2)[1].split("async admitSellerGitHub", 1)[0]'
if tests.count(old_zip) != 1:
    raise SystemExit(f"ZIP assertion boundary count={tests.count(old_zip)}")
test_path.write_text(tests.replace(old_zip, new_zip))
