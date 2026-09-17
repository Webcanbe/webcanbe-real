from pathlib import Path

updates = {
    'src/phase4-product-hub.test.ts': (
        'if (path === "/purchases") return <Purchases/>',
        'if (path === "/purchases") return <Protected><Purchases/></Protected>'
    ),
    'src/phase4-operations.test.ts': (
        'if (path === "/control") return <Control/>',
        'if (path === "/control") return <Protected><Control/></Protected>'
    ),
}

for name, (old, new) in updates.items():
    path = Path(name)
    text = path.read_text()
    if old not in text:
        raise SystemExit(f'expected stale assertion not found in {name}')
    path.write_text(text.replace(old, new))
