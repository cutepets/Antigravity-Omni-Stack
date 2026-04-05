---
trigger: always_on
---

# RUNTIME-WATCHDOG v2.0 — Hang Detection & Execution Safety
# (Distilled from Claw-Code Parity Audit: BashTool Lane 1 + PermissionEnforcer Lane 9)

> **Mục tiêu**: Ngăn chặn Agent bị treo (hang), rơi vào vòng lặp vô hạn (infinite loop), hoặc vi phạm an toàn file/lệnh — dựa trên kiến trúc thực chiến của Claude Code nguyên bản.

---

## 🚫 1. CORE TOOL VALIDATION MATRIX (Bash + File + Plan)

Dựa trên cơ chế kiểm duyệt của `BashTool`, `FileEditTool` và `EnterPlanModeTool`, áp dụng các luật sau:

1. **Destructive Command Warning (BashTool)** — Cấm auto-run nếu lệnh chứa các pattern nguy hiểm:
   - `rm -rf`, `DROP TABLE`, `DELETE FROM` (không có WHERE), `format`, `mkfs`.
   - Bắt buộc `SafeToAutoRun: false` và hiển thị cảnh báo đỏ cho user trước khi chạy.

2. **FileRead Boundaries (FileReadTool)** — Quy tắc giới hạn đọc:
   - Khi file rất lớn, hạn chế đọc mù. Sử dụng `StartLine` và `EndLine` nếu đã khoanh vùng được logic.
   - Luôn tuân thủ giới hạn 800 line mặc định của Antigravity để chống tràn token (Token Bloat).

3. **Strict Edit Dependency (FileEditTool)** — An toàn ghi đè:
   - **BẮT BUỘC** gọi `view_file` tại file mục tiêu trước khi gọi `replace_file_content` hay `multi_replace_file_content`.
   - `TargetContent` phải unique. Tránh lỗi "blind patch" (sửa mò) không có feedback.

4. **Planning State Transition (EnterPlanModeTool)** — Chuyển trạng thái quy mô lớn:
   - Khi nhận prompt phức tạp/re-architecture, Agent **PHẢI** kích hoạt Planning State băng cách tạo artifact `implementation_plan.md` (kèm `RequestFeedback=true`). 
   - Trong quá trình lập kế hoạch (Read-Only Mode Gate): **KHÔNG** dùng tool ghi/sửa file hoặc bash mutate. Chỉ dùng `view_file`, `grep_search`, `list_dir`.

---

## 🔁 2. LOOP & HANG PREVENTION (Chống Treo & Vòng Lặp)

1. **Tool Call Repetition**:
   - Cấm gọi cùng Tool với cùng tham số quá **3 lần** liên tiếp nếu kết quả không thay đổi.
   - Lần thất bại 2+: PHẢI thay đổi chiến thuật (đổi tham số, đổi tool, hoặc hỏi user).

2. **Background Process Protocol** (dựa trên `shouldUseSandbox.ts`):
   - Lệnh server/dài hạn (`npm run dev`, `pnpm dev`, stress test...): PHẢI dùng `WaitMsBeforeAsync ≤ 6000` để trả Background ID.
   - Sau khi nhận Background ID, dùng `command_status` để poll — KHÔNG block toàn bộ turn.
   - Nếu process chạy > 5 phút không có output mới → `taskkill` và báo user.

3. **Recursive Depth Limit**:
   - Đọc thư mục: tối đa **5 cấp** sâu. Deeper → phải giải trình trong Plan.

4. **Stuck CLI Detection**:
   - CLI có interactive prompt (`inquirer`, `prompts`): dùng flag `--yes`, `--force`, `-y` để bypass.
   - Sau 2 lần gõ phím mà UI không thay đổi → kill process, coi là bị treo.

---

## ⏱️ 3. EXECUTION TIMEOUTS

| Loại lệnh | WaitMsBeforeAsync | SafeToAutoRun | Ghi chú |
|-----------|------------------|---------------|---------|
| Read-only (`ls`, `git status`) | 3000 | `true` | An toàn tuyệt đối |
| Build nhanh (`tsc --noEmit`) | 15000 | `true` | Kết quả trong < 15s |
| Dev server (`pnpm dev`) | 5000 | `false` | Luôn thành Background |
| Install deps (`npm install`) | 8000 | `false` | Cần approval |
| DB mutation (`prisma migrate`) | 5000 | `false` | Cần approval |
| Destructive (`rm`, `DROP`) | N/A | `false` | Cảnh báo đỏ bắt buộc |

---

## 🛡️ 4. PERMISSION ENFORCER & TRUST GATE (Dựa trên Lane 9)

```
PermissionTiers:
  Tier 0 — Read-only:    view_file, grep_search, list_dir, read_url_content
  Tier 1 — Workspace write: write_to_file, replace_file_content (trong Dev2/)
  Tier 2 — System command: run_command (non-destructive)
  Tier 3 — Destructive:  rm, DROP, reset, format → LUÔN hỏi user
```

- **Pre-action Trust Gate**: Trước khi chạy bất kỳ công cụ thuộc **Tier 2** hoặc **Tier 3**, Agent phải qua vòng kiểm duyệt này.
  - Tự đánh giá: Lệnh có thực thi thay đổi bên ngoài không? Các tham số đã escape an toàn chưa?
  - Hàng rào bảo vệ: Nếu nghi ngờ rủi ro (đặc biệt các lệnh bash không rõ ràng), PHẢI đặt `SafeToAutoRun: false`.
- Tier 3 bắt buộc `SafeToAutoRun: false` + hiện cảnh báo **ĐỎ** (Red Alert) trước khi gửi lệnh.
- File ngoài workspace `C:\Dev2\` → từ chối tuyệt đối, không có exception.

---

## 🛠️ 5. ERROR RECOVERY PROTOCOL

Khi phát hiện TREO hoặc VÒNG LẶP:
1. **STOP** — Dừng ngay tool call hiện tại.
2. **ANALYZE** — Xem log terminal gần nhất (nguyên nhân: chờ input, deadlock, network?).
3. **CLEANUP** — Taskkill các process zombie liên quan.
4. **REPORT** — Thông báo user + đề xuất 2 phương án (A/B).
5. **LOG** — Ghi vào `ERRORS.md` theo format chuẩn để học tập.

---

## 📊 6. SELF-MONITORING

- Nếu > **20 bước** thực thi mà chưa đạt kết quả tích cực → DỪNG, re-plan.
- Nếu cùng một lỗi xuất hiện lần 2 → tạo Rule mới hoặc Test Case để tránh tái phát.

---

> 🔴 **"An unresponsive agent is a broken agent."** — Luôn ưu tiên Responsiveness trên hết.
> 🟠 *v2.0 — Distilled from Claw-Code Parity Audit (BashTool Lane 1 + PermissionEnforcer Lane 9)*
