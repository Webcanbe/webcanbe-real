from pathlib import Path

path = Path('src/phase4-public-production.test.ts')
lines = path.read_text().splitlines()
replaced = False
out = []
for line in lines:
    if 'for (const token of' in line and 'expect(server).toContain(token)' in line:
        out.extend([
            '    expect(server).toContain(String.raw`auth\\/complete`)',
            '    expect(server).toContain("dashboard")',
            '    expect(server).toContain(String.raw`project\\/[a-z0-9-]+`)',
            '    expect(server).toContain(String.raw`checkout\\/[A-Za-z0-9_.:-]+`)',
            '    expect(server).toContain(String.raw`workspace\\/(?:northstar|[a-f0-9-]{36})`)',
        ])
        replaced = True
    else:
        out.append(line)
if not replaced:
    raise SystemExit('SPA route assertion line not found')
path.write_text('\n'.join(out) + '\n')
