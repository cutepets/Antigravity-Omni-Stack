"""
Encoding Audit Script for Petshop Management V2
Scans all Python scripts + checks TypeScript/JS files for Buffer/fs usage without explicit encoding.
"""
import os
import re

root = r'c:\Dev2\Petshop_Management_V2'
exclude_dirs = {'node_modules', '.git', '.turbo', 'dist', 'build', '.next', 'uploads', '__pycache__'}

issues = []

# ─────────────────────────────────────────────
# 1) Python files: open() without encoding='utf-8'
# ─────────────────────────────────────────────
py_pattern = re.compile(r'open\s*\(')
py_encoding_ok = re.compile(r"encoding\s*=\s*['\"]utf-?8['\"]", re.IGNORECASE)

for dirpath, dirnames, filenames in os.walk(root):
    dirnames[:] = [d for d in dirnames if d not in exclude_dirs]
    for fname in filenames:
        if fname.endswith('.py'):
            fpath = os.path.join(dirpath, fname)
            try:
                with open(fpath, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                for i, line in enumerate(lines, 1):
                    if py_pattern.search(line) and not py_encoding_ok.search(line):
                        # Ignore comment lines
                        stripped = line.strip()
                        if not stripped.startswith('#'):
                            issues.append({
                                'file': fpath, 'line': i,
                                'type': 'Python open() missing encoding',
                                'content': stripped
                            })
            except Exception as e:
                issues.append({'file': fpath, 'line': 0, 'type': 'READ ERROR', 'content': str(e)})

# ─────────────────────────────────────────────
# 2) TypeScript/JS: fs.readFile / fs.writeFile / createWriteStream without encoding
# ─────────────────────────────────────────────
ts_read_pattern = re.compile(r'fs\.(readFile|writeFile|appendFile|createReadStream|createWriteStream)\s*\(')
ts_encoding_ok = re.compile(r"['\"]utf-?8['\"]", re.IGNORECASE)

for dirpath, dirnames, filenames in os.walk(root):
    dirnames[:] = [d for d in dirnames if d not in exclude_dirs]
    for fname in filenames:
        if fname.endswith(('.ts', '.tsx', '.js', '.mjs', '.cjs')):
            fpath = os.path.join(dirpath, fname)
            try:
                with open(fpath, 'r', encoding='utf-8') as f:
                    content = f.read()
                    lines = content.splitlines()

                for i, line in enumerate(lines, 1):
                    stripped = line.strip()
                    if stripped.startswith('//') or stripped.startswith('*'):
                        continue
                    if ts_read_pattern.search(line):
                        # Check the next 3 lines too (multiline calls)
                        block = ' '.join(lines[i-1:min(i+3, len(lines))])
                        if not ts_encoding_ok.search(block):
                            issues.append({
                                'file': fpath, 'line': i,
                                'type': 'TS/JS fs call missing utf-8',
                                'content': stripped[:120]
                            })
            except Exception as e:
                issues.append({'file': fpath, 'line': 0, 'type': 'READ ERROR', 'content': str(e)})

# ─────────────────────────────────────────────
# 3) TypeScript: Buffer.from() without 'utf8' encoding
# ─────────────────────────────────────────────
buf_pattern = re.compile(r'Buffer\.from\s*\(')
buf_encoding_ok = re.compile(r"['\"]utf-?8['\"]", re.IGNORECASE)

for dirpath, dirnames, filenames in os.walk(root):
    dirnames[:] = [d for d in dirnames if d not in exclude_dirs]
    for fname in filenames:
        if fname.endswith(('.ts', '.tsx', '.js', '.mjs', '.cjs')):
            fpath = os.path.join(dirpath, fname)
            try:
                with open(fpath, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                for i, line in enumerate(lines, 1):
                    stripped = line.strip()
                    if stripped.startswith('//') or stripped.startswith('*'):
                        continue
                    if buf_pattern.search(line):
                        block = ' '.join(l.strip() for l in lines[i-1:min(i+2, len(lines))])
                        if not buf_encoding_ok.search(block):
                            issues.append({
                                'file': fpath, 'line': i,
                                'type': 'Buffer.from() missing utf-8',
                                'content': stripped[:120]
                            })
            except Exception:
                pass  # Already captured above

# ─────────────────────────────────────────────
# Print results
# ─────────────────────────────────────────────
print(f"\n{'='*70}")
print("ENCODING AUDIT REPORT - Petshop Management V2")
print(f"{'='*70}\n")

if not issues:
    print("✅ No encoding issues found!")
else:
    by_type = {}
    for issue in issues:
        t = issue['type']
        by_type.setdefault(t, []).append(issue)

    for type_name, items in by_type.items():
        print(f"\n[{type_name}] — {len(items)} occurrences")
        print("-" * 60)
        for item in items:
            rel = item['file'].replace(root + os.sep, '')
            print(f"  {rel}:{item['line']}")
            print(f"    >> {item['content']}")

    print(f"\n{'='*70}")
    print(f"TOTAL ISSUES: {len(issues)}")
    print(f"{'='*70}\n")
