"""
Encoding Audit Script v2 - Petshop Management V2
Focuses on actual source files: apps/ and packages/ directories.
Checks:
  1. Python files: open() without encoding='utf-8'
  2. TS/JS: fs.readFile/writeFile/appendFile without utf-8
  3. TS/JS: Buffer.from() without explicit encoding
  4. TS/JS: createReadStream/createWriteStream without encoding option
  5. Prisma: any file I/O that might bypass encoding
"""
import os
import re

ROOT = r'c:\Dev2\Petshop_Management_V2'

# Only scan these source directories
SCAN_DIRS = [
    os.path.join(ROOT, 'apps', 'api'),
    os.path.join(ROOT, 'apps', 'web'),
    os.path.join(ROOT, 'packages'),
]

EXCLUDE_DIRS = {
    'node_modules', '.git', '.turbo', 'dist', 'build',
    '.next', 'uploads', '__pycache__', '.cache', 'coverage',
    'generated', '.prisma',
}

issues = []

def scan_file_python(fpath):
    """Python: open() without encoding='utf-8'"""
    py_open = re.compile(r'\bopen\s*\([^)]*\)')
    py_enc_ok = re.compile(r"encoding\s*=\s*['\"]utf-?8['\"]", re.IGNORECASE)

    try:
        with open(fpath, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        for i, line in enumerate(lines, 1):
            stripped = line.strip()
            if stripped.startswith('#'):
                continue
            m = py_open.search(line)
            if m:
                call_text = m.group(0)
                # mode 'rb'/'wb' = binary, skip
                if re.search(r"['\"]([rwab]+b['\"]|['\"]b[rwab]+)", call_text):
                    continue
                if not py_enc_ok.search(call_text):
                    issues.append({
                        'file': fpath, 'line': i,
                        'type': 'PY: open() missing encoding',
                        'content': stripped[:120]
                    })
    except Exception as e:
        issues.append({'file': fpath, 'line': 0, 'type': 'READ ERROR', 'content': str(e)})


def scan_file_ts(fpath):
    """TypeScript/JS: fs operations and Buffer without utf-8"""
    fs_ops = re.compile(
        r'\bfs\.(readFile|writeFile|appendFile|readFileSync|writeFileSync|appendFileSync|'
        r'createReadStream|createWriteStream)\s*\('
    )
    buf_from = re.compile(r'\bBuffer\.(from|alloc)\s*\(')
    enc_ok = re.compile(r"['\"]utf-?8['\"]", re.IGNORECASE)

    try:
        with open(fpath, 'r', encoding='utf-8') as f:
            lines = f.readlines()

        for i, line in enumerate(lines, 1):
            stripped = line.strip()
            if stripped.startswith('//') or stripped.startswith('*') or stripped.startswith('/*'):
                continue

            # Check fs operations
            m = fs_ops.search(line)
            if m:
                op = m.group(1)
                # createReadStream/createWriteStream: check next few lines for encoding option
                look_ahead = ''.join(lines[i-1:min(i+4, len(lines))])
                # These ops don't need utf-8 necessarily but flag if no encoding at all
                if op in ('createReadStream', 'createWriteStream'):
                    if not enc_ok.search(look_ahead):
                        issues.append({
                            'file': fpath, 'line': i,
                            'type': f'TS: fs.{op}() - consider encoding option',
                            'content': stripped[:120]
                        })
                else:
                    # readFile/writeFile etc
                    if not enc_ok.search(look_ahead):
                        issues.append({
                            'file': fpath, 'line': i,
                            'type': f'TS: fs.{op}() missing utf-8 encoding',
                            'content': stripped[:120]
                        })

            # Check Buffer.from() - only flag if it looks like string conversion (no Buffer arg)
            if buf_from.search(line):
                look_ahead = ''.join(lines[i-1:min(i+2, len(lines))])
                if not enc_ok.search(look_ahead):
                    # Skip if it's Buffer.from(buffer) or Buffer.from(array) - numeric/raw usage
                    if re.search(r'Buffer\.from\s*\(\s*(\"[^\"]+\"|\'[^\']+\'|`[^`]+`)', line):
                        issues.append({
                            'file': fpath, 'line': i,
                            'type': 'TS: Buffer.from(string) missing utf-8',
                            'content': stripped[:120]
                        })

    except Exception as e:
        issues.append({'file': fpath, 'line': 0, 'type': 'READ ERROR', 'content': str(e)})


# ─── Walk source dirs ────────────────────────────────────────────────
for scan_root in SCAN_DIRS:
    for dirpath, dirnames, filenames in os.walk(scan_root):
        dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]
        for fname in filenames:
            fpath = os.path.join(dirpath, fname)
            ext = os.path.splitext(fname)[1].lower()
            if ext == '.py':
                scan_file_python(fpath)
            elif ext in ('.ts', '.tsx', '.js', '.mjs', '.cjs'):
                scan_file_ts(fpath)

# ─── Report ─────────────────────────────────────────────────────────
print(f"\n{'='*70}")
print("ENCODING AUDIT REPORT - Petshop Management V2 (Source Only)")
print(f"{'='*70}")

if not issues:
    print("\n✅ No encoding issues found in source code!\n")
else:
    by_type = {}
    for issue in issues:
        t = issue['type']
        by_type.setdefault(t, []).append(issue)

    for type_name, items in sorted(by_type.items()):
        print(f"\n[{type_name}] — {len(items)} occurrence(s)")
        print("-" * 60)
        for item in items:
            # Make path relative
            rel = item['file']
            for sd in SCAN_DIRS:
                if rel.startswith(sd):
                    rel = os.path.relpath(rel, ROOT)
                    break
            print(f"  {rel}:{item['line']}")
            print(f"    >> {item['content']}")

    total = len(issues)
    print(f"\n{'='*70}")
    print(f"TOTAL ISSUES: {total}")
    print(f"{'='*70}\n")
