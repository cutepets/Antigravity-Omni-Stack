# GITNEXUS-INTEGRATION.MD - Thuần hóa GitNexus

> **Mục tiêu**: Đảm bảo công cụ GitNexus khi (để lập đồ thị Code Intelligence) không sinh ra file hệ thống thừa (.claude/ hay CLAUDE.md) làm xung đột kiến trúc Antigravity.

---

## 🚫 1. QUY ĐỊNH CHẠY LỆNH GỐC (FORBIDDEN DIRECT EXECUTION)

**KHÔNG BAO GIỜ** được chạy trực tiếp lệnh:
`npx gitnexus analyze` hoặc `npx gitnexus analyze --embeddings`

- **Lý do**: Lệnh gốc của GitNexus mặc định sẽ tự động tạo ra thư mục `.claude` và chèn hướng dẫn vào file `CLAUDE.md`. Điều này phá vỡ cấu trúc `.agent` chuẩn của hệ thống và gây "loạn" (Split-Brain) cho Agent vì nó làm ghi đè `AGENTS.md`.

---

## ✅ 2. CÁCH THỨC VẬN HÀNH CHUẨN (STANDARD OPERATING PROCEDURE)

Khi cần cập nhật (index) lại codebase cho GitNexus, Agent **BẮT BUỘC** phải ưu tiên chạy:

1. Dùng NPM Script:
   ```bash
   npm run gitnexus-update
   ```

2. Hoặc chạy file Script Node trực tiếp:
   ```bash
   node .agent/scripts/gitnexus-sync.js
   ```

- **Hành động của Wrapper**: Script này sẽ kích hoạt GitNexus ngầm, sau đó tự động:
  1. Hốt toàn bộ Document Skill do GitNexus sinh ra vào `.agent/skills/gitnexus/`.
  2. Xóa triệt để thư mục mồ côi `.claude`.
  3. Xóa file `CLAUDE.md`.
  4. Cập nhật đường dẫn chuẩn trong `AGENTS.md`.

---

## 🔄 3. SLASH COMMAND `/gitnexus-update`

Để thao tác thân thiện với người dùng, khi có yêu cầu cập nhật GitNexus, hãy kích hoạt file workflow `.agent/workflows/gitnexus-update.md` hoặc báo với User là chỉ cần gõ "chạy `/gitnexus-update`".
