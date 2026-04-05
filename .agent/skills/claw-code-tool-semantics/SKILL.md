---
name: claw-code-tool-semantics
description: >
  Canonical tool routing & responsibility schema extracted from Claw-Code Parity Audit
  (Claude Code upstream — 184 tool modules, 9 validation lanes). Defines when and how
  each core tool should be invoked, with exact parameter semantics and permission tiers.
  Load this when planning complex multi-tool pipelines or debugging tool routing issues.
version: 1.0.0
source: c:\Dev2\claw-code (Parity Audit — PARITY.md + tools_snapshot.json)
---

# Claw-Code Tool Semantics — Canonical Reference

> Trích xuất từ kiến trúc Claude Code nguyên bản (184 tool modules, 9 Rust parity lanes).
> Dùng như "bản đồ thần kinh" để quyết định **dùng tool nào** và **payload chuẩn** ra sao.

---

## 🧠 Tool Selection Decision Tree

```
Câu hỏi cần trả lợi → Chọn:
  Đọc file / xem nội dung?         → view_file (FileReadTool)
  Tìm file theo pattern?            → grep_search (GrepTool) | list_dir (GlobTool)
  Sửa một đoạn code cụ thể?        → replace_file_content / multi_replace (FileEditTool)
  Tạo file mới hoàn toàn?          → write_to_file (FileWriteTool)
  Chạy lệnh shell?                 → run_command (BashTool / PowerShellTool)
  Tìm kiếm text trong nhiều file?  → grep_search (GrepTool)
  Chạy agent con?                  → browser_subagent (AgentTool)
```

---

## 📋 Core Tool Responsibility Matrix

### 1. FileReadTool → `view_file`
- **Responsibility**: Đọc nội dung file, trả về line-by-line với line numbers. Hỗ trợ ảnh/video nhị phân.
- **Khi dùng**: Trước mọi thao tác edit — LUÔN đọc file trước khi patch.
- **Limits**: MAX_READ_SIZE enforced. Dùng `StartLine`/`EndLine` cho file lớn (> 200 LOC).
- **Parity lane**: Lane 3 — edge-case guards (binary detection, size limits, workspace boundary).

```json
{
  "AbsolutePath": "C:\\Dev2\\...\\file.ts",
  "StartLine": 1,
  "EndLine": 100
}
```

### 2. FileEditTool → `replace_file_content` / `multi_replace_file_content`
- **Responsibility**: Sửa code bằng cách thay thế TargetContent → ReplacementContent. Không ghi đè toàn bộ file.
- **Khi dùng**: Sửa ít dòng liên tiếp → `replace_file_content`. Nhiều vị trí khác nhau → `multi_replace_file_content`.
- **Bảo vệ**: TargetContent PHẢI unique trong file. Nếu not found → `view_file` lại trước khi retry.
- **Parity lane**: Lane 3 — sedValidation, patch safety checks.

```json
{
  "TargetFile": "C:\\Dev2\\...\\file.ts",
  "TargetContent": "// exact match string",
  "ReplacementContent": "// new content",
  "AllowMultiple": false
}
```

### 3. FileWriteTool → `write_to_file`
- **Responsibility**: Tạo file mới hoàn toàn. Ghi đè nếu `Overwrite: true`.
- **Khi dùng**: File chưa tồn tại, hoặc cần rewrite toàn bộ nội dung.
- **Bảo vệ**: Workspace boundary enforced (chỉ viết trong `C:\Dev2\`).
- **Parity lane**: Lane 3 — write_file_allowed vs write_file_denied scenario.

### 4. GrepTool → `grep_search`
- **Responsibility**: Tìm kiếm text pattern trong nhiều file. Trả về filename + line number + content.
- **Khi dùng**: Tìm function/class/variable trong codebase rộng. Tìm tất cả import của một module.
- **Tối ưu**: Dùng `Includes` để filter file type (`*.ts`, `*.tsx`). `IsRegex: true` cho pattern phức tạp.

```json
{
  "SearchPath": "C:\\Dev2\\project",
  "Query": "useAuthStore",
  "Includes": ["*.ts", "*.tsx"],
  "IsRegex": false,
  "MatchPerLine": true
}
```

### 5. GlobTool → `list_dir`
- **Responsibility**: Liệt kê files/thư mục. Trả về metadata (size, child count).
- **Khi dùng**: Khám phá cấu trúc dự án. Tìm file theo vị trí thư mục.
- **Giới hạn**: MAX 5 cấp sâu. Không dùng để tìm nội dung (dùng grep_search thay thế).

### 6. BashTool / PowerShellTool → `run_command`
- **Responsibility**: Chạy lệnh shell. Hỗ trợ background process với CommandId.
- **Validation Matrix** (vận hành từ 18 sub-modules của upstream):

| Sub-module | Quy tắc |
|------------|---------|
| `destructiveCommandWarning` | `rm -rf`, `DROP`, `format` → `SafeToAutoRun: false` |
| `pathValidation` | `Cwd` PHẢI absolute, trong workspace |
| `modeValidation` | Read-only phase → chỉ dùng non-mutating commands |
| `sedValidation` | Không patch file bằng sed inline trong shell |
| `shouldUseSandbox` | Long-running → `WaitMsBeforeAsync: 5000` → Background ID |
| `commandSemantics` | Không dùng `cd` standalone — dùng `Cwd` parameter |

```json
{
  "CommandLine": "pnpm run dev",
  "Cwd": "C:\\Dev2\\project",
  "WaitMsBeforeAsync": 5000,
  "SafeToAutoRun": false
}
```

### 7. AgentTool → `browser_subagent`
- **Responsibility**: Fork sub-agent với task mô tả cụ thể. Agent con hoạt động độc lập trong browser context.
- **Built-in agents**:
  - `generalPurposeAgent` — Đa năng, tương tác web tổng quát.
  - `planAgent` — Lập kế hoạch implementation từ yêu cầu.
  - `verificationAgent` — Kiểm tra kết quả sau khi thực thi.
  - `exploreAgent` — Khám phá codebase/web để thu thập context.
- **Khi dùng**: Task cần UI interaction, nhiều bước trên trình duyệt, hay khi cần parallel execution.

### 8. TodoWriteTool → Task Management
- **Responsibility**: Ghi/cập nhật TODO list cho session hiện tại. Tracking tiến độ.
- **Map sang Antigravity**: `task.md` artifact (planning mode).

### 9. LSPTool
- **Responsibility**: Tương tác Language Server — diagnostics, go-to-definition, hover, references, symbols.
- **Parity lane**: Lane 8 — LspRegistry (symbols, references, diagnostics, definition, hover).
- **Khi dùng**: Khi cần xác minh type, tìm định nghĩa symbol chính xác thay vì grep.

---

## 🛡️ Permission Tiers (Từ Lane 9 — PermissionEnforcer)

```
Tier 0 (Read-only):
  - view_file, grep_search, list_dir, read_url_content
  - SafeToAutoRun: true khi nào cũng được

Tier 1 (Workspace Write):
  - write_to_file, replace_file_content
  - SafeToAutoRun: true NẾU trong C:\Dev2\
  - SafeToAutoRun: false nếu ngoài workspace

Tier 2 (System Command — Non-destructive):
  - run_command (git status, npm list, tsc --noEmit)
  - SafeToAutoRun: true cho read-only commands

Tier 3 (Destructive / External):
  - run_command với rm, DROP TABLE, npm publish, git push --force
  - SafeToAutoRun: LUÔN false — phải hỏi user
```

---

## ⚡ Execution Timeout Reference

| Tool | WaitMsBeforeAsync | Ghi chú |
|------|-------------------|---------|
| `tsc --noEmit` (type check) | 15000 | Đồng bộ OK |
| `pnpm run dev` (server) | 5000 | Background → poll với `command_status` |
| `git status`, `ls` | 3000 | Read-only, auto-approve |
| `npm install`, `pnpm install` | 8000 | Cần user approval |
| `prisma migrate deploy` | 5000 | DB mutation — cần approval |

---

## 🔀 Multi-Tool Pipeline Patterns

### Pattern 1: Explore → Read → Edit (Chuẩn)
```
list_dir() → grep_search() → view_file() → replace_file_content()
```

### Pattern 2: Build → Verify → Fix
```
run_command(tsc --noEmit) → grep_search(error) → view_file() → replace_file_content() → run_command(tsc --noEmit)
```

### Pattern 3: Install → Serve → Test
```
run_command(pnpm install, async) → command_status(id) → run_command(pnpm dev, async) → browser_subagent(test)
```

---

## 📌 Anti-Patterns (Học từ Claw-Code Bugs)

| Anti-pattern | Vấn đề | Fix |
|-------------|--------|-----|
| `run_command("cd X && do_thing")` | State mismatch giữa turns | Dùng `Cwd: "X"` parameter |
| `replace_file_content` không `view_file` trước | TargetContent không match | LUÔN view_file trước khi patch |
| `run_command(npm run dev)` không có WaitMs | Block toàn bộ session | `WaitMsBeforeAsync: 5000` |
| Loop: same tool, same params > 3 lần | Infinite retry | Đổi chiến thuật hoặc hỏi user |
| `write_to_file` cho file đã tồn tại | Ghi đè mất code quan trọng | Dùng `replace_file_content` thay thế |
| Gọi `list_dir` > 5 cấp | Token bloat + chậm | Filter bằng `grep_search` với Includes |

---

> 🔧 *v1.0.0 — Extracted from Claw-Code Parity Audit (2026-04-05). Rust port: 9 lanes merged, 40 tool specs validated.*
> 📌 *Source: `C:\Dev2\claw-code\PARITY.md` + `src/reference_data/tools_snapshot.json` + `src/reference_data/commands_snapshot.json`*
