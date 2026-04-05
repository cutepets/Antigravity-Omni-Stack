---
name: Claw-Code Auditor
description: >
  Sử dụng `claw-code-parity` bằng Python để audit, trích xuất cấu trúc tool/routing
  của Claude Code nguyên gốc nhằm khắc phục các điểm nghẽn kiến trúc (deadloop, poor
  context parsing) cho Antigravity. Đã được nâng cấp với kết quả audit thực tế từ
  PARITY.md (9 Rust lanes, 184 tools, 40 exposed tool specs).
version: 2.0.0
---

# Skill: Claw-Code Auditor v2.0

> **Cố Vấn Kiến Trúc** — Kết hợp sandbox Python `C:\Dev2\claw-code` với kiến thức
> PARITY.md đã trích xuất để chuẩn hóa Tool Routing và Execution Safety của Antigravity.

---

## 🔔 Trigger Tự Động

Load skill này khi:
1. Agent rơi vào infinite tool call loop (gọi cùng tool > 3 lần).
2. Thiết kế hệ thống đa Agent mới — cần chuẩn hóa job/process phân phối.
3. User dùng `/claw-code` hoặc hỏi về cách Claude Code quản lý file/context.
4. Cần kiểm tra xem tool X đang được routing đúng chưa.

---

## 🏗️ Kiến Trúc Đã Audit (Kết quả thực tế)

Từ PARITY.md tại `C:\Dev2\claw-code`:
- **184 tool modules** trong snapshot (`tools_snapshot.json`)
- **40 tool specs** được expose trực tiếp qua `mvp_tool_specs()` (Rust port on main)
- **9 validation lanes** — tất cả đã merge vào main
- Core execution tools: `bash`, `read_file`, `write_file`, `edit_file`, `glob_search`, `grep_search`

### 9 Lanes Quan Trọng Nhất

| Lane | Nội dung | Áp dụng cho Antigravity |
|------|----------|------------------------|
| 1. BashTool Validation | 18 sub-modules: readOnly, destructive, mode, sed, path, semantics | `runtime-watchdog.md` |
| 3. File-tool edge cases | Binary detection, MAX_READ_SIZE, workspace boundary, symlink | `view_file` limits |
| 4. TaskRegistry | in-memory task lifecycle create/get/list/stop/update | `task.md` tracking |
| 9. PermissionEnforcer | Tool gating, file write boundary, bash read-only | Permission tier system & **Pre-action Trust Gate** |

---

## 🔬 Quy Trình Audit (3 Cấp)

### Cấp 1: Phân Tích Cấu Trúc

```powershell
# Cwd phải là C:\Dev2\claw-code — KHÔNG dùng cd
python -m src.main summary
```
→ Trích xuất manifest và session config (max tokens: 2000, max turns: 8).

### Cấp 2: Routing Consultation

```powershell
python -m src.main route "<prompt cần kiểm tra>"
```
→ Output: `kind\tname\tscore\tsource_hint` — đọc tool có score cao nhất.

**Ví dụ thực tế đã chạy:**
```
route "read a large file"     → FileReadTool (score 3) ✅
route "edit code lines"       → FileEditTool (score 3) ✅
route "run background server" → bashCommandHelpers (score 1) → dùng BashTool với WaitMs
route "search TypeScript files" → ToolSearchTool (score 3) → dùng GrepTool với Includes
route "migrate POS module"    → generalPurposeAgent (score 2) ⚠️ → **BÀI HỌC:** Yêu cầu phức tạp phải được **Decompose (bẻ nhỏ)** trước khi gọi tool để tránh routing yếu.
```

### Cấp 3: Tool Reverse-Engineering

```powershell
# Liệt kê tất cả tools (dùng --query để filter)
python -m src.main tools --query Bash
python -m src.main tools --query File

# Xem schema của tool cụ thể
python -m src.main show-tool BashTool

# Nếu muốn responsibility đầy đủ, đọc trực tiếp từ snapshot:
python extract_tools.py
```

> ⚠️ `show-tool` chỉ trả về tên và source_hint. Responsibility schema đầy đủ đã được
> distill vào `claw-code-tool-semantics/SKILL.md` — đọc file đó thay vì audit lại.

---

## 📦 Kết Quả Đã Distill (Dùng Ngay, Không Cần Audit Lại)

| Artifact | Nội dung | Nơi lưu |
|----------|----------|---------|
| Tool Semantics | Responsibility matrix, payload chuẩn, anti-patterns | `.agent/skills/claw-code-tool-semantics/SKILL.md` |
| Runtime Watchdog | BashTool validation, Permission tiers, Timeout table | `.agent/rules/runtime-watchdog.md` |

---

## 🔄 Học Tiếp (Khi Cần Audit Mới)

Nếu phát hiện bug mới hoặc cần kiểm tra tool chưa có trong skills:
1. Chạy `python -m src.main route "<triệu chứng>"`
2. Xem tool score cao nhất → đó là tool system khuyên dùng
3. Đọc PARITY.md tại section Lane tương ứng để hiểu ngữ nghĩa sâu hơn
4. **Cập nhật `claw-code-tool-semantics/SKILL.md`** với kiến thức mới — không để mất!

---

> 🔵 *v2.0 — Distilled from live audit session 2026-04-05. Route tests validated across 4 scenarios.*
> 📌 *Source: `C:\Dev2\claw-code\PARITY.md`, `tools_snapshot.json`, 184 mirrored tool modules*
