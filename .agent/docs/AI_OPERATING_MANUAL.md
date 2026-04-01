# CẨM NANG VẬN HÀNH AI (AI OPERATING MANUAL)

Cẩm nang này là **Luật bắt buộc (Mandatory)** đối với mọi AI hoạt động trong không gian làm việc này. Bất kể ngữ cảnh hoặc lệnh người dùng, AI phải luôn chiếu quy tắc sau để ra quyết định và sử dụng Tools/Skills.

## 1. Mục Tiêu Tối Thượng: Tiết Kiệm Token & Tránh Ảo Giác

- **Tránh nhúng toàn bộ file cấu hình**: Khi tìm kiếm Skill, tuyệt đối không dùng lệnh hoặc tool call tự động load toàn bộ skill nếu không cần thiết. Chỉ load Skill có tiền tố đúng nghiệp vụ (VD: `react-*`, `seo-*`).
- **Giới hạn số công cụ & Skill kích hoạt đồng thời**: Không nạp quá 3 skill cùng lúc cho một Task. 
- **Không tự ý chuyển ngữ cảnh**: Đang fix bug thì không tự nạp kỹ năng Testing hay Design. Hoàn thành từng pha một theo Checklist.

## 2. Luật Dừng Khẩn Cấp (Auto-Approve Stop Rule) [CRITICAL]

Do người dùng kích hoạt công cụ **Tự động phê duyệt (Auto-Confirm)**, AI tuyệt đối không lạm dụng để bỏ qua các quyết định logic của con người. 
- Nếu gặp phải phân nhánh công việc mang tính chất Thiết kế (ví dụ: dùng màu nào, chọn API bên thứ 3 nào, cấp quyền Database như thế nào)... 
- Hoặc nếu gặp lỗi bảo toàn dữ liệu (Có file bị xóa/ghi đè nguy hiểm).
-> AI PHẢI đặt một câu hỏi rõ ràng cho người dùng với tiền tố `[NEEDS_HUMAN_INPUT]` và **DỪNG HOÀN TOÀN CUỘC HỘI THOẠI (Dừng execution)**. Không được tiếp tục sinh ra Tool Call nào khác ở cuối tin nhắn, trả quyền điều khiển lại để ép hệ thống Auto-Confirm khựng lại chờ người dùng nhập tay.

## 3. Quy Trình Sử Dụng Skills (Skill Invocation Rules)

Hệ thống Skills đã được dọn dẹp và quy hoạch lại. Tham khảo thêm `SYSTEM_MAP.md` để biết tổng quan.

1. **Giai đoạn Thiết kế (Design/Planning)**: 
   - Sử dụng Master Skills: `c4-master` (Kiến trúc), `api-master` (Giao tiếp API), `database-design` (Lược đồ dữ liệu).

2. **Giai đoạn Code Web (Implement/Web)**:
   - Dùng các bộ chuẩn của framework như `react-best-practices`, `nextjs-best-practices`, `tailwind-patterns`.

3. **Giai đoạn Viết Tool / Scripting (Python)**:
   - Sử dụng `python-pro`, `python-patterns`, `python-reviewer` để sinh công cụ data/scraping khi cần.

4. **Giai đoạn Backend / Microservices**:
   - Dùng `nodejs-best-practices` và các chuẩn `*-patterns` như Postgres.

5. **Kỹ năng Tên miền râu ria (Marketing, SEO, GSD)**:
   - Các kỹ năng này hiện đã được đóng băng hoặc giới hạn, CHỈ sử dụng khi người dùng có nhắc đến các từ khóa cụ thể.

## 4. Quản lý Agents (Hệ thống Nhân sự)

Người dùng đã tinh giản đội ngũ xuống mức tối thiểu (Core Agents) cho JS/TS và Python.
- **Frontend / Backend / Python Tooling / DevOps**: Sử dụng các nhân sự trong `.agent/agents` tương ứng.
- **Roleplay Protocol**: Khi kích hoạt một Agent, hãy thông báo rõ ràng "🤖 Tôi đang mang tư duy của [Agent Name]".

## 5. Kết Luận (Final Directive)
Là một Assistant thông minh, sự chính xác (Precision) quan trọng hơn sự màu mè (Verbose). Hãy tuân thủ cẩm nang này mỗi khi bạn cảm thấy chênh vênh không biết dùng Skill nào.
