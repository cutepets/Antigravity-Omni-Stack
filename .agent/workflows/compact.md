---
description: Nén bộ nhớ session khi chat quá dài. Tóm tắt mạch công việc, xóa rác token, giữ nguyên tiến độ để tiếp tục ngay.
---

# /compact — Nén & Giải Phóng Bộ Nhớ

Khi hội thoại quá dài, AI bắt đầu loãng — gõ `/compact` để tóm tắt lại những gì quan trọng, xóa context thừa, và chuẩn bị cho giai đoạn tiếp theo mà không mất mạch công việc.

## Khi nào nên dùng

- Chat đã đi qua **nhiều phase** (research → plan → implement → debug)
- Cảm giác AI đang **trở nên lạc**, lặp lại, hoặc quên context cũ
- Sắp chuyển sang task **hoàn toàn khác nhau**
- Đã **hoàn thành một milestone** và muốn fresh start cho phase tiếp
- Sau khi debug xong một lỗi lớn → clean context trước khi code tiếp

## Khi KHÔNG nên dùng

- Đang giữa chừng implement một file → compact sẽ mất tên biến, partial state
- Vừa mới bắt đầu session (< 20 tool calls)

---

## Quy trình thực hiện

### Bước 1 — Thu thập ngữ cảnh hiện tại

Trước khi compact, thu thập toàn bộ context còn quan trọng:

```bash
# Xem files đã thay đổi trong session này
git diff --name-only
git log --oneline -10
```

Hỏi bản thân: **"Nếu session này bị restart, tôi cần biết gì để tiếp tục?"**

### Bước 2 — Tạo Compact Snapshot

Tạo file snapshot tại `.agent/memory/compact-YYYY-MM-DD-HH.md`:

```bash
mkdir -p .agent/memory
```

Viết file với format sau:

```markdown
# Compact Snapshot — {DATE} {TIME}

## 🎯 Mục tiêu hiện tại
[Anh đang làm gì? Câu trả lời 1-2 dòng]

## ✅ Đã hoàn thành (confirmed)
- [việc 1] — evidence: [test pass / deploy OK / user xác nhận]
- [việc 2] — evidence: ...

## 🔴 Chưa xong / Đang dở
- [việc 3] — status: [đang làm / bị block vì gì]
- [việc 4] — status: ...

## ❌ Đã thử nhưng KHÔNG DÙNG (đừng thử lại)
- [approach A] — vì: [lý do cụ thể / error cụ thể]

## 📂 Files đang trong tay
| File | Trạng thái | Ghi chú |
|------|-----------|---------|
| path/to/file.ts | ✅ Done | Đã test |
| path/to/other.ts | 🔄 WIP | Còn thiếu phần X |
| path/to/new.ts | 📋 Todo | Chưa tạo |

## 🔑 Quyết định kỹ thuật đã chốt
- [Dùng X thay vì Y] — vì: [lý do]
- [Pattern Z] — đã áp dụng ở [file/component]

## 🚀 Bước tiếp theo CHÍNH XÁC
[1 câu mô tả ACTION cụ thể nhất phải làm khi resume]
Ví dụ: "Mở file `src/auth/middleware.ts`, implement hàm `validateJWT()` theo pattern tại `src/auth/utils.ts:42`"

## ⚠️ Blockers / Câu hỏi chưa giải
- [blocker 1]
- [câu hỏi chưa rõ]
```

### Bước 3 — Đề xuất Native Compact

Sau khi snapshot được lưu, thông báo:

```
✅ Compact snapshot đã lưu tại: .agent/memory/compact-{DATE}.md

Bây giờ anh có thể:
  1. Gõ `/compact` trong Claude Code để native compact (tóm tắt conversation history)
  2. Hoặc bắt đầu session mới và gõ `/resume` để load snapshot này

Bước tiếp theo: {EXACT_NEXT_STEP}
```

### Bước 4 — Gợi ý thời điểm compact tiếp theo

Dựa trên phase hiện tại:

| Đang ở phase | Compact? | Lý do |
|---|---|---|
| Vừa xong research | ✅ Nên | Research context nặng, chỉ cần giữ plan |
| Vừa xong plan | ✅ Nên | Plan đã save vào file, free context để code |
| Giữa chừng implement | ❌ Không | Mất variable names, partial state |
| Vừa fix xong bug | ✅ Nên | Debug traces ô nhiễm context tiếp theo |
| Sắp chuyển task khác | ✅ Nên | Fresh context cho task mới |

---

## Cái gì SURVIVE sau compact

| Survive ✅ | Mất ❌ |
|-----------|--------|
| GEMINI.md / CLAUDE.md instructions | Conversation history chi tiết |
| Files trên disk (code, config) | Tool call history |
| Git commits & branches | Analysis trung gian |
| `.agent/memory/` snapshots | File contents đã read vào context |
| task.md / TodoWrite list | Nuance từ cuộc trò chuyện |
| Tất cả các file đã lưu | Reasoning steps chưa được ghi lại |

**Quy tắc vàng:** Nếu nó quan trọng → ghi vào file trước khi compact.

---

## Liên quan

- `/resume-session` — Load compact snapshot và tiếp tục công việc
- `/save-session` — Phiên bản chi tiết hơn, dùng khi kết thúc toàn bộ session
- `/context` — Xem cái gì đang ngốn token trước khi quyết định compact
