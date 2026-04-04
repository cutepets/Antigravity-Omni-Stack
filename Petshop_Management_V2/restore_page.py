import sys
import re

log_path = r"C:\Users\Admin\.gemini\antigravity\brain\c5f28a68-d507-4fcf-a8da-c0ded23190c1\.system_generated\logs\overview.txt"
with open(log_path, "r", encoding="utf-8") as f:
    text = f.read()

# Find the block where view_file response returned the 534 line version
# The text will look like: 
# The following code has been modified to include a line number before every line...
# 1: 'use client';
# ...
# 534: 
target = r"File Path: `file:///c:/Dev2/Petshop_Management_V2/apps/web/src/app/%28dashboard%29/pos/page.tsx`\nTotal Lines: 534\n.*?\n1: 'use client';(.*?)The above content shows the entire"

match = re.search(target, text, re.DOTALL)
if match:
    code_block = "1: 'use client';" + match.group(1)
    # clean up the line numbers
    lines = code_block.split('\n')
    cleaned_lines = []
    for line in lines:
        if re.match(r"^\d+: ", line):
            cleaned_lines.append(line.split(": ", 1)[1])
        else:
            if line.strip(): # ignore empty string at end
                cleaned_lines.append(line)
    
    with open(r"c:\Dev2\Petshop_Management_V2\apps\web\src\app\(dashboard)\pos\page.tsx", "w", encoding="utf-8") as w:
        w.write("\n".join(cleaned_lines))
    print("RESTORED SUCCESSFULLY")
else:
    print("COULD NOT FIND MATCH")
