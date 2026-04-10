import re

fp = r'c:\Dev2\Petshop_Management_V2\apps\web\src\app\(dashboard)\pos\page.tsx'
with open(fp, 'r', encoding='utf-8') as f:
    content = f.read()

# All known patterns with replacement char U+FFFD
fixes = [
    # Title "Tạo đơn mới (F2)" - the đ was already fixed but Tạo ?ơn remains
    ('Tạo \ufffd?\ufffd?ơn mới', 'Tạo đơn mới'),
    # Stock tooltip: '??' -> 'N/A'
    ("'\\ufffd??'", "'N/A'"),
    ('\ufffd??', 'N/A'),
    # Đổi trả hàng
    ('Đ\ufffd?i trả hàng', 'Đổi trả hàng'),
]

changed = 0
for broken, correct in fixes:
    if broken in content:
        n = content.count(broken)
        content = content.replace(broken, correct)
        changed += n
        print(f'  [{n}x] fixed')

with open(fp, 'w', encoding='utf-8') as f:
    f.write(content)

print(f'Total: {changed} replacements')

remaining = [(i+1, l) for i, l in enumerate(content.splitlines()) if '\ufffd' in l]
print(f'Remaining bad lines: {len(remaining)}')
for ln, c in remaining[:6]:
    print(f'  L{ln}: {repr(c.strip()[:100])}')
