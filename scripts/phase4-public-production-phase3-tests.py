from pathlib import Path

path = Path('src/webcanbe-engine/phase3-hosted-product.test.ts')
text = path.read_text()
updates = [
    (
        'it("wires authenticated catalog, operator TEST purchase, idempotent materialization, My Projects, and tenant isolation", async () => {',
        'it("wires public catalog, operator TEST purchase, idempotent materialization, My Projects, and tenant isolation", async () => {'
    ),
    (
        'expect(await call({}, "/catalog/browse", {})).toMatchObject({ status: 403 })',
        'expect(await call({}, "/catalog/browse", {})).toMatchObject({ status: 200, body: { listings: [{ listingId: f.listing.listingId, releaseId: f.release.releaseId }] } })'
    ),
    (
        'it("requires authenticated HTTP and ignores client attempts to self-assert operator authority", async () => {',
        'it("keeps catalog public while private HTTP ignores client attempts to self-assert operator authority", async () => {'
    ),
    (
        'await controller.handle(unauthenticated.request, unauthenticated.response); expect(unauthenticated.result().status).toBe(403)',
        'await controller.handle(unauthenticated.request, unauthenticated.response); expect(unauthenticated.result().status).toBe(200)'
    ),
]
for old, new in updates:
    if old not in text:
        raise SystemExit(f'expected inherited assertion not found: {old[:80]}')
    text = text.replace(old, new, 1)
path.write_text(text)
