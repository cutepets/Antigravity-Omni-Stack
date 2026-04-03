---
description: Truy vấn cố vấn kiến trúc hệ thống mô phỏng Claude Code (Claw-Code-Parity)
---

# Lệnh /claw-code

Trình cố vấn kiến trúc (Parity Auditor) dành cho Cấu trúc Agent (Agent Harness) và hệ thống Tool/Command. `claw-code-parity` là hệ thống giả lập môi trường Claude Code giúp đội ngũ Antigravity tham chiếu, audit kiến trúc, và trích xuất phương pháp định tuyến xử lý tự động hiệu quả nhất.

## 🛠 Cách dùng cơ bản

Trong các cửa sổ Terminal hoặc IDE, sử dụng CLI của kho lưu trữ `claw-code` (viết bằng Python) để truy vấn cấu trúc:

```bash
# Đầu tiên luôn vào thư mục chứa code mô phỏng
cd c:\Dev2\claw-code

# Chạy bằng Python (đảm bảo phiên bản >= 3.10)
python -m src.main <tên-lệnh>
```

### 1. Đối chiếu Hệ thống & Đánh giá (Parity Audit)

Chẩn đoán cấu trúc dự án so với cấu trúc gốc của hệ thống Claude Code.
```bash
python -m src.main summary
python -m src.main parity-audit
```

### 2. Định tuyến (Routing Engine)

Mô phỏng thuật toán mà Claude Code phân tích 1 prompt và đưa ra quyết định gọi Tool/Command nào hiệu quả nhất. (Rất có sức nặng khi gặp Task đa tầng khó phân luồng).

```bash
python -m src.main route "Thêm tính năng đăng nhập bằng Clerk và tạo file API"
```

### 3. Từ Điển Công Cụ (Tool & Command Architecture)

Muốn xem kiến trúc các tools (ví dụ: BashTool, FileEditTool) mà bản gốc ứng dụng? Liệt kê chức năng:

```bash
python -m src.main tools
python -m src.main commands
python -m src.main show-tool "FileEditTool"
```

## 🧠 Dành riêng cho Agent (Skill Integration)

Bọn em (AI Agents) thường kết hợp Workflow này với skill `claw-code-auditor`. Bất cứ lúc nào hệ thống rơi vào luồng lặp vô tận (infinite loop), hoặc quá tốn kém do gọi Tool lắt nhắt thiếu hiệu quả, hãy yêu cầu sử dụng `/claw-code` để chẩn đoán lại kiến trúc Tool Pattern.
