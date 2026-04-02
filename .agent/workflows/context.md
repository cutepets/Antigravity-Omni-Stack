---
description: Quản lý token budget — soi xem cái gì đang ngốn token (file nào nặng, skill nào thừa). Tiết kiệm API cost.
---

# /context — Quản Trị Token Budget

Scan toàn bộ setup để tìm ra **cái gì đang chiếm context window** — rules, skills, MCP servers, conversation history — và đưa ra khuyến nghị cụ thể để giảm chi phí API.

## Khi nào dùng

- Hệ thống chạy chậm / AI trả lời loãng (dấu hiệu context bị overload)
- Trước khi thêm agent/skill mới
- Muốn tối ưu chi phí API
- Sau khi thêm nhiều rules/agents mới

---

## Quy trình thực hiện

### Phase 1 — Inventory (Kiểm kê)

Scan 5 nguồn tiêu thụ token chính:

```bash
# 1. Rules — luôn loaded, không thể tránh
Get-ChildItem -Path ".agent/rules" -Filter "*.md" | ForEach-Object { 
  $size = (Get-Item $_.FullName).Length
  Write-Host "$($_.Name): $size bytes"
}
```

```bash
# 2. Skills — loaded theo agent
Get-ChildItem -Path ".agent/skills" -Recurse -Filter "SKILL.md" | ForEach-Object {
  $size = (Get-Item $_.FullName).Length
  $folder = $_.DirectoryName | Split-Path -Leaf
  Write-Host "$folder/SKILL.md: $size bytes"
} | Sort-Object
```

```bash
# 3. Agents — loaded khi trigger
Get-ChildItem -Path ".agent/agents" -Filter "*.md" | ForEach-Object {
  $size = (Get-Item $_.FullName).Length
  Write-Host "$($_.Name): $size bytes"
}
```

```bash
# 4. GEMINI.md / CLAUDE.md — baseline cost mỗi request
Get-ChildItem -Path "." -Filter "GEMINI.md" -Recurse | ForEach-Object {
  Write-Host "$($_.FullName): $((Get-Item $_.FullName).Length) bytes"
}
```

```bash
# 5. Workflows — loaded khi invoke
Get-ChildItem -Path ".agent/workflows" -Filter "*.md" | Measure-Object -Property Length -Sum
```

### Phase 2 — Token Estimation

Dùng heuristic: **`bytes / 3.5 ≈ tokens`** (cho text tiếng Anh/Việt mix)

Tính toán và xếp hạng:

| Component | Bytes | Tokens est. | Khi nào loaded |
|---|---|---|---|
| GEMINI.md (rules) | ? | ? | Mỗi request |
| system-architect agent | ? | ? | Khi trigger |
| devops-engineer agent | ? | ? | Khi trigger |
| [top 5 skills theo size] | ? | ? | Khi agent trigger |
| MCP servers config | ? | ? | Mỗi request |

### Phase 3 — Phát hiện vấn đề

Kiểm tra các anti-patterns:

**🔴 Critical (fix ngay):**
- Rules file > 50KB → quá nặng cho baseline
- Agent có > 40 skills → context loãng, trim xuống
- Skill > 10KB mà không có sub-skills → monolith, nên split
- 2 skill folders cover cùng domain → duplicate

**⚠️ Warning (xem xét):**
- GEMINI.md tổng > 15KB → cần trim lại
- Agent bị trigger bởi quá nhiều keywords → false positive activation
- Skill folder có SKILL.md nhưng trỏ tới sub-skills không tồn tại

**💡 Opportunities:**
- Skills không được reference trong bất kỳ agent nào → orphan
- Workflows chỉ là stub gọi sang skill → gộp lại

### Phase 4 — Báo cáo

Output theo format:

```
═══════════════════════════════════════
  CONTEXT BUDGET REPORT — {DATE}
  Model: claude-sonnet-4-5 | Window: ~200K tokens
═══════════════════════════════════════

📊 BASELINE (loaded every request)
  GEMINI.md rules:     {X} tokens  [{Y}%]
  MCP servers:         {X} tokens  [{Y}%]
  ─────────────────────────────────────
  Total baseline:      {X} tokens  [{Y}% of window]

🤖 LARGEST AGENTS (on activation)
  1. system-architect   {X} tokens  ({N} skills)
  2. devops-engineer    {X} tokens  ({N} skills)  
  3. frontend-specialist {X} tokens ({N} skills)
  ...

📚 TOP 10 HEAVIEST SKILLS
  1. context-manager/SKILL.md      {X} tokens
  2. [skill]                        {X} tokens
  ...

🔴 CRITICAL ISSUES ({N} found)
  • [issue 1] → [fix gợi ý]
  • [issue 2] → [fix gợi ý]

⚠️ WARNINGS ({N} found)
  • [warning 1]

💡 QUICK WINS
  • Trim devops-engineer: 33 skills → est. save {X} tokens/activation
  • Merge duplicate X và Y skills: save {X} tokens
  • [opportunity N]

🎯 RECOMMENDED ACTIONS (by ROI)
  1. [action với impact cao nhất]
  2. [action 2]
  3. [action 3]

Muốn tối ưu ngay? Gõ /compact để giải phóng conversation context.
```

---

## Arguments

```
/context              — Summary report (mặc định)
/context --verbose    — Full breakdown từng file
/context --agents     — Chỉ phân tích agents
/context --skills     — Chỉ phân tích skills  
/context --rules      — Chỉ phân tích rules
```

## Liên quan

- `/compact` — Giải phóng conversation context sau khi đã biết cái gì nặng
- `/context-budget` — Phiên bản cũ hơn, chỉ lý thuyết
- `token-budget-advisor` skill — Control response depth cho từng câu hỏi
