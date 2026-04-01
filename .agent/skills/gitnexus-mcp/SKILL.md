---
name: gitnexus-mcp
description: Lập bản đồ codebase, Index dự án thành Knowledge Graph với GitNexus, kết nối với AI Agent thông qua MCP để phân tích kiến trúc sâu.
origin: Custom
---

# GitNexus - Codebase Intelligence

GitNexus là một hệ thống phân tích mã nguồn "Zero-Server" (Local-first). Nó biến Codebase (repo) thành một **Knowledge Graph** (Sơ đồ tri thức) giúp AI hoặc lập trình viên truy vấn cấu trúc, call chains, dependency cực kỳ nhanh và chuẩn xác hơn là search text thông thường.

## Khi nào AI nên kích hoạt GitNexus?
- Khi User yêu cầu phân tích quy mô lớn toàn bộ dự án (Architectural Analysis).
- Khi muốn dò tìm *Blast Radius* (Tìm xem nếu sửa hàm A thì có những Component B, C nào bị ảnh hưởng toàn cục).
- Khi tìm các Anti-patterns, vòng lặp phụ thuộc (Circular Dependencies) trong toàn mạng lưới file.

## Các lệnh thực thi (Nên chạy ngầm Background hoặc qua CLI Tool)

### 1. Phân tích & Index Codebase (Bắt buộc chạy trước 1 lần)
```bash
npx gitnexus@1.4.10 analyze
# Lệnh này sẽ quét toàn bộ repo và tạo Knowledge Graph trong bộ đệm máy tính (ở ~/.gitnexus).
# Lưu ý: Cần có thư mục .git, nếu không dùng `npx gitnexus@1.4.10 analyze --skip-git`
```

### 2. Dọn rác & Index lại (Nếu Graph bị hỏng)
```bash
npx gitnexus@1.4.10 clean && npx gitnexus@1.4.10 analyze
```

### 3. Kích hoạt giao diện trực quan UI (Tùy chọn cho người dùng)
Nếu muốn mở giao diện web để chính con người kéo thả xem node network:
```bash
npx gitnexus@1.4.10 ui
```

### 4. Kết nối cho Agent (MCP Setup)
GitNexus đi kèm một **MCP Server** để kết nối vào IDE. Nếu cần cung cấp các file JSON thiết lập `.claude` hoặc `Cursor`, hãy dùng:
```bash
npx gitnexus@1.4.10 setup
```
Hoặc dùng cấu hình JSON trần cho MCP:
```json
{
  "mcpServers": {
    "gitnexus": {
      "command": "npx",
      "args": ["-y", "gitnexus@1.4.10", "mcp"]
    }
  }
}
```

## Lưu ý cho Assistant (Tránh lỗi)
- BẢN 1.5.0 CHÍNH THỨC CỦA GITNEXUS BỊ LỖI THIẾU PACKAGE `gitnexus-shared`. Hãy luôn hướng dẫn người dùng sử dụng bản `@1.4.10` bằng mọi giá.
- Nếu bị lỗi `ERR_MODULE_NOT_FOUND` hoặc lỗi Path trên Windows, hãy khuyên người dùng gõ `npm cache clean --force` rồi `npm i -g gitnexus@1.4.10` trước khi analyze lại.
- Nếu dự án không có `.git`, phải thêm flag `--skip-git`.
- Dữ liệu Graph là local, bảo mật và an toàn 100%. Không upload code lên mây.
