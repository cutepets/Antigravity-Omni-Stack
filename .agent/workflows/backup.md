---
description: Tự động gom code (add) và sao lưu phiển bản (commit) mọi thay đổi hiện tại với timestamp, tránh mất mát dữ liệu hoặc config.
---

### Mục đích & Lợi ích
Bất cứ khi nào bạn viết xong tính năng hoặc sửa các config rác, chỉ cần dùng lệnh `/backup`. AI sẽ tự tạo version Git Snapshot và commit lại an toàn cho bạn, giúp bạn quay ngược thời điểm nếu bản code kế tiếp bị lỗi do ảo giác hoặc nghịch dại.

### Các bước thực thi (AI Actions)

1. **Khởi tạo (Nếu chưa có)**: Nhận dạng nếu dự án chưa có `git init` thì gọi lệnh này trước.
2. **Kiểm tra file rác**: Đảm bảo tệp `.gitignore` đã chặn các thư mục nặng như `node_modules`, `.gitnexus` (database cục bộ đồ thị code) và logs.
// turbo
3. **Sao lưu**: Sử dụng chuỗi lệnh (Terminal):
   ```bash
   git add .
   git commit -m "Auto Backup: $(date +'%Y-%m-%d %H:%M:%S')"
   ```
4. **Báo cáo**: Hiển thị bảng tóm tắt Git Status hoặc log xem có bao nhiêu file đã được commit. Đề xuất lệnh push lên Github nếu người dùng có kết nối Remote URL.

### Lưu ý cho AI:
- Không bao giờ xoá lịch sử commit cũ (như `git reset --hard` hay `rebase`) nếu người dùng không yêu cầu rõ ràng. Chỉ ADD và COMMIT.
