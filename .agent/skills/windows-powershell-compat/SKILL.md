---
name: windows-powershell-compat
description: PowerShell-safe equivalents for common Unix commands on Windows. Git patterns, file operations, and terminal workarounds for AI agents running on Windows dev machines.
evolved_from:
  - P001-powershell-head-fix
  - P002-targeted-git-add
  - P004-gitignore-defaults
  - I07-auto-backup-commit
version: 1.0.0
---

# Windows PowerShell Compatibility

Auto-triggers when: running commands on Windows, CI/CD with PowerShell, git operations on large repos.

## ⚠️ Common Pitfalls

### Unix → PowerShell Translation

| ❌ Unix/Bash | ✅ PowerShell Equivalent |
|---|---|
| `cmd \| head -30` | `cmd \| Select-Object -First 30` |
| `echo "line\n"` | `Write-Host "line\`n"` (backtick) |
| `Add-Content file -Value "\n"` | `Add-Content file -Value "\`n"` |
| `which node` | `Get-Command node` |
| `ls -la` | `Get-ChildItem -Force` |
| `cat file` | `Get-Content file` |
| `rm -rf dir` | `Remove-Item dir -Recurse -Force` |
| `mkdir -p path` | `New-Item path -ItemType Directory -Force` |

### Safe Cross-Platform (works everywhere)
```bash
git log --oneline -5          # ✅ safe
git status --short            # ✅ safe
git add <specific-paths>      # ✅ safe
node -e "..."                 # ✅ safe
```

## 📁 Git Best Practices on Windows

### Targeted git add (avoid blocking on large repos)
```powershell
# ❌ Blocks when background processes are running
git add .

# ✅ Target specific directories
git add .agent/ GEMINI.md docs/ .planning/ .gitignore
$ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
git commit -m "Auto Backup: $ts — <description>"
```

### Auto-backup pattern
```powershell
$ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
git add .agent/ src/ docs/
git commit -m "Auto Backup: $ts"
```

## 🚫 .gitignore Defaults for AI/Agent Projects

Always include:
```gitignore
# AI graph databases (auto-regenerated)
.gitnexus/

# Generated audit reports
.reports/

# One-off debug scripts at repo root
check-*.js
gsd-*.js
skill-audit.js
debug-*.js

# Node (standard)
node_modules/
.env
.env.local
```

## 📝 Content Writing in PowerShell

```powershell
# Multi-line content (use heredoc)
$content = @"
Line 1
Line 2
Line 3
"@
Set-Content -Path "file.txt" -Value $content

# Append with newline
Add-Content -Path "file.txt" -Value "`nNew line"  # backtick-n

# Read file content
$text = Get-Content "file.txt" -Raw
```

## 🔍 File Search Equivalents

```powershell
# Find files by extension
Get-ChildItem ".agent/skills" -Recurse -Filter "*.md"

# Find files matching pattern
Get-ChildItem ".agent" -Recurse | Where-Object { $_.Name -match "SKILL" }

# Get file sizes (like du -sh)
Get-ChildItem ".agent/skills" -Recurse -Filter "SKILL.md" |
  Measure-Object -Property Length -Sum
```
