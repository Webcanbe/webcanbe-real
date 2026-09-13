#!/usr/bin/env python3
"""Local macOS QA runner, not a public import service.

Builds an exported project in a fresh directory using copied, dedicated profile
packages. All uploaded Node-side configuration runs under sandbox-exec with no
network, no user-directory reads, no writes outside the job, a clean environment,
and a process-group timeout. Never invokes uploaded package scripts or npm install.
"""
import argparse
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import tempfile
import uuid
import zipfile

parser = argparse.ArgumentParser()
parser.add_argument('archive', type=Path)
parser.add_argument('output', type=Path, help='New empty local validation directory')
args = parser.parse_args()
if sys.platform != 'darwin' or not Path('/usr/bin/sandbox-exec').exists():
    raise SystemExit('NOT YET: an approved OS-isolated export runner is unavailable.')
repository = Path(__file__).resolve().parents[1]
profile = repository / 'runtime-profiles/react19-vite6'
job = args.output.resolve()
job.mkdir(parents=True, exist_ok=False)
project = job / 'project'
project.mkdir()
with zipfile.ZipFile(args.archive) as archive:
    if args.archive.stat().st_size > 25 * 1024 * 1024 or len(archive.infolist()) > 2000 or sum(entry.file_size for entry in archive.infolist()) > 40 * 1024 * 1024:
        raise SystemExit("Export archive exceeds bounded QA limits.")
    for entry in archive.infolist():
        target = project / entry.filename
        if target.resolve() == project or not target.resolve().is_relative_to(project) or '\\' in entry.filename or entry.file_size > 2 * 1024 * 1024 or entry.file_size / max(1, entry.compress_size) > 100 or (entry.external_attr >> 16) & 0o170000 == 0o120000:
            raise SystemExit('Unsafe exported archive member.')
        if entry.is_dir():
            target.mkdir(parents=True, exist_ok=True)
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            with target.open('xb') as output:
                output.write(archive.read(entry))
manifest = json.loads((project / 'package.json').read_text())
lock = json.loads((project / 'package-lock.json').read_text())
pins = json.loads((profile / 'package.json').read_text())['dependencies']
profile_lock = json.loads((profile / 'package-lock.json').read_text())['packages']
for name, version in {**manifest.get('dependencies', {}), **manifest.get('devDependencies', {})}.items():
    if version != pins.get(name) or lock['packages'].get('node_modules/' + name, {}).get('version') != version:
        raise SystemExit('This QA runner requires exact fixture manifest/lock/profile agreement: ' + name)
# Copy actual package files into the clean job; never resolve through editor node_modules.
for file in (profile / 'node_modules').rglob('*'):
    if file.is_symlink() and not file.resolve().is_relative_to((profile / 'node_modules').resolve()):
        raise SystemExit('Dedicated runtime contains an external symlink.')
shutil.copytree(profile / 'node_modules', project / 'node_modules', symlinks=False)
for location, record in lock['packages'].items():
    installed = project / location / 'package.json'
    if location and installed.exists() and (json.loads(installed.read_text())['version'] != record['version'] or profile_lock.get(location, {}).get('integrity') != record.get('integrity')):
        raise SystemExit('Installed package differs from export lock: ' + location)
node = Path(shutil.which('node')).resolve()
policy = job / 'sandbox.sb'
quote = lambda value: json.dumps(str(value))
policy.write_text('''(version 1)
(deny default)
(allow process-fork)
(allow sysctl-read)
(allow file-read-metadata)
(allow mach-lookup (global-name "com.apple.system.logger") (global-name "com.apple.system.opendirectoryd.libinfo"))
(allow file-read* (literal "/") (subpath "/System") (subpath "/usr/lib") (subpath "/usr/share") (subpath "/usr/bin") (subpath "/Library/Apple") (subpath "/opt/homebrew/Cellar") (subpath "/dev") (subpath JOB))
(allow file-write* (subpath JOB) (literal "/dev/null"))
(allow process-exec (literal NODE) (subpath ESBUILD))
'''.replace('JOB', quote(job)).replace('NODE', quote(node)).replace('ESBUILD', quote(project / 'node_modules/@esbuild')))
(job / 'tmp').mkdir()
environment = {'PATH': str(node.parent) + ':/usr/bin:/bin', 'TMPDIR': str(job / 'tmp'), 'NODE_ENV': 'production'}
def run(arguments):
    process = subprocess.Popen(['/usr/bin/sandbox-exec', '-f', str(policy), str(node), '--openssl-config=/dev/null', *arguments], cwd=project, env=environment, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, start_new_session=True)
    try:
        output, _ = process.communicate(timeout=45)
    except subprocess.TimeoutExpired:
        os.killpg(process.pid, signal.SIGKILL)
        process.communicate()
        raise SystemExit('Sandboxed job exceeded 45 seconds; its process group was stopped.')
    if process.returncode:
        print(output)
        raise SystemExit('Sandboxed command failed: ' + str(process.returncode))
    return output
with tempfile.TemporaryDirectory(prefix='wcb-export-canary-') as outside:
    canary = Path(outside) / 'private.txt'
    canary.write_text('synthetic-private-' + str(uuid.uuid4()))
    probe = '''const fs=require('node:fs'),cp=require('node:child_process'),net=require('node:net');
let read=false,write=false,exec=false;
try{fs.readFileSync(CANARY)}catch(e){read=e.code==='EPERM'||e.code==='EACCES'}
try{fs.writeFileSync(CANARY,'bad')}catch(e){write=e.code==='EPERM'||e.code==='EACCES'}
try{cp.execFileSync('/bin/sh',['-c','exit 0'],{stdio:'ignore'})}catch(e){exec=e.code==='EPERM'||e.code==='EACCES'}
const socket=net.connect(9,'127.0.0.1');socket.on('error',e=>{const network=e.code==='EPERM'||e.code==='EACCES';console.log(JSON.stringify({read,write,exec,network}));process.exit(read&&write&&exec&&network?0:1)});
'''.replace('CANARY', quote(canary))
    probe_result = run(['-e', probe])
    if not canary.read_text().startswith('synthetic-private-'):
        raise SystemExit('Sandbox outside-write probe failed.')
print('ISOLATION PROBE', probe_result.strip())
# Invoke the pinned Vite tool directly, not the uploaded build/lifecycle script.
log = run([str(project / 'node_modules/vite/bin/vite.js'), 'build'])
(job / 'build.log').write_text(log)
dist = project / 'dist'
if not (dist / 'index.html').exists():
    raise SystemExit('Export did not build an application.')
for file in dist.rglob('*'):
    if file.is_symlink():
        raise SystemExit('Export build emitted a symlink.')
    if file.is_file() and file.suffix in ('.js', '.html', '.css'):
        content = file.read_text()
        if 'data-wcb-id' in content or '__webcanbe' in content or 'previewBridge' in content:
            raise SystemExit('Export depends on WebCanBe instrumentation.')
(job / 'result.json').write_text(json.dumps({'status': 'PASS', 'archive': str(args.archive.resolve()), 'profile': 'react19-vite6', 'isolation': json.loads(probe_result), 'dist': str(dist), 'packageScriptsExecuted': False}, indent=2))
print(log)
print('EXPORT BUILD PASS:', dist)
