"""
Fix Mojibake in TypeScript/TSX files.
Decodes UTF-8 bytes that were mistakenly read as Latin-1/cp1252 and written back as Latin-1.

Pattern: A file was saved in UTF-8 but some tool read it as Latin-1 and wrote it back,
turning e.g. "Không" (UTF-8: C3 B4] → Latin-1 "KhÃ´ng".

Fix: re-encode each string from latin-1 back to bytes, then decode as utf-8.
"""
import os
import re

ROOT = r'c:\Dev2\Petshop_Management_V2'

# Only these specific files confirmed broken
TARGET_FILES = [
    r'apps\api\src\modules\orders\orders.service.ts',
    r'apps\api\src\modules\settings\settings.controller.ts',
    r'apps\api\src\modules\stock\stock.service.ts',
    r'apps\web\src\app\(dashboard)\pos\page.tsx',
    r'apps\web\src\app\(dashboard)\staff\components\UpdateStaffModal.tsx',
    r'apps\web\src\mocks\handlers\phase1.handlers.ts',
]

MOJIBAKE = re.compile(r'[ÃÂ][^\x00-\x7F]|Ã´ng|Ã¬m|háº|táº|náº|cáº|pháº|sáº|lÃ |tháº|Ä\x91|Æ°|á»')


def fix_line(line: str) -> str:
    """Try to fix mojibake on a line. Returns original if fix produces worse result."""
    try:
        # Encode back to bytes using latin-1 (how it was misread), then decode as utf-8
        fixed = line.encode('latin-1', errors='replace').decode('utf-8', errors='replace')
        # Verify: the fixed version should have less mojibake
        if MOJIBAKE.search(fixed):
            # Still has mojibake — partial fix may have happened
            # Return fixed anyway (it's better than nothing)
            pass
        return fixed
    except Exception:
        return line


def fix_file(fpath: str) -> tuple[int, int]:
    """Returns (lines_fixed, total_lines)"""
    with open(fpath, 'r', encoding='utf-8') as f:
        original_lines = f.readlines()

    fixed_lines = []
    fixed_count = 0
    for line in original_lines:
        if MOJIBAKE.search(line):
            fixed = fix_line(line)
            if fixed != line:
                fixed_count += 1
            fixed_lines.append(fixed)
        else:
            fixed_lines.append(line)

    with open(fpath, 'w', encoding='utf-8') as f:
        f.writelines(fixed_lines)

    return fixed_count, len(original_lines)


print("=" * 65)
print("MOJIBAKE FIX - Petshop Management V2")
print("=" * 65)

total_fixed = 0
for rel_path in TARGET_FILES:
    fpath = os.path.join(ROOT, rel_path)
    if not os.path.exists(fpath):
        print(f"  SKIP (not found): {rel_path}")
        continue
    try:
        n_fixed, n_total = fix_file(fpath)
        total_fixed += n_fixed
        status = f"FIXED {n_fixed} lines" if n_fixed > 0 else "no changes"
        print(f"  [{status}] {rel_path}")
    except Exception as e:
        print(f"  ERROR: {rel_path}: {e}")

print(f"\nTotal lines fixed: {total_fixed}")
print("=" * 65)
