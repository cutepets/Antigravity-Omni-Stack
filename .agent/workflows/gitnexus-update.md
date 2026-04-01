---
description: Thuần hóa và tích hợp an toàn GitNexus vào kiến trúc Antigravity
---
# /gitnexus-update

Workflow này giúp hệ thống chạy `GitNexus Analyze` một cách an toàn mà không sinh ra rác (không tạo thư mục `.claude` hay file dư thừa `CLAUDE.md`). Rất hữu ích khi cần update index code cho AI chạy tác vụ.

1. Khởi động script đồng bộ hóa
// turbo
2. Chạy lệnh: `node .agent/scripts/gitnexus-sync.js`
3. Ghi status thành công vào log
4. Khởi động lại workflow hoặc chuyển sang task tiếp theo (Done).
