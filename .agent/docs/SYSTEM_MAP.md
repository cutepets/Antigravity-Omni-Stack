# BẢN ĐỒ KỸ NĂNG VÀ NHÂN SỰ HỆ THỐNG (SYSTEM MAP)

*Map này giúp định vị các tác vụ (Tasks) sẽ do đội ngũ Agents và Skills nào đảm nhận một cách chuyên biệt, tách lớp rõ ràng.*

---

## 1. Tầng Nhận Diện & Thiết Kế (Planning & Core)

**Mục đích**: Nhận yêu cầu phức tạp từ người dùng, lập kế hoạch, vẽ sơ đồ và ra quyết định kiến trúc.

*   **Agents phụ trách**:
    *   `planner` - Băm nhỏ yêu cầu thành Tasks (Phase 1, 2...).
    *   `architect` - Định hướng cấu trúc Cây thư mục.
    *   `orchestrator` - Người điều phối luồng làm việc theo chuỗi.
*   **Skills (Năng lực đính kèm)**:
    *   `c4-master`: Dựng sơ đồ (Context, Container, Component, Code).
    *   `database-design`: Vạch ra Lược đồ Dữ liệu (ERD).
    *   `architecture`: Các mẫu thiết kế hệ thống nói chung.
    *   `gitnexus-mcp`: Knowledge Graph phân tích Codebase toàn cục.

---

## 2. Tầng Phát Triển Frontend (Client-side)

**Mục đích**: Chịu trách nhiệm về Giao diện, trải nghiệm người dùng, logic bên ngoài trình duyệt hoặc ứng dụng.

*   **Agents phụ trách**:
    *   `frontend-specialist`: Viết mã UI, tích hợp API từ Backend.
*   **Skills (Năng lực đính kèm)**:
    *   `react-master` / `react-best-practices`
    *   `nextjs-best-practices`
    *   `tailwind-patterns`
    *   `frontend-patterns`
    *   `ui-ux-pro-max` (Nếu cần nhúng animation, motion cao cấp).

---

## 3. Tầng Phát Triển Backend (Server-side & API)

**Mục đích**: Quản trị Node.js / TypeScript, Database, và luồng dữ liệu (Microservices, monolith).

*   **Agents phụ trách**:
    *   `backend-specialist`: Giao tiếp Database, Authentication, Business Logic.
    *   `database-reviewer`: Review, tối ưu truy vấn SQL / NoSQL.
*   **Skills (Năng lực đính kèm)**:
    *   `api-master` (Thiết kế REST/GraphQL/gRPC).
    *   `nodejs-best-practices`.
    *   `backend-patterns`.
    *   `postgres-patterns` / `postgres-best-practices` (Cơ sở dữ liệu).

---

## 4. Tầng Dữ Liệu & Viết Công Cụ (Python Tooling)

**Mục đích**: Phân tích dữ liệu, viết Script bóc tách Web (Scraping), tự động hoá, AI Tools, hoặc các Tool mà hệ sinh thái NodeJS làm không mượt.

*   **Agents phụ trách**:
    *   `python-reviewer`
*   **Skills (Năng lực đính kèm)**:
    *   `python-pro`.
    *   `python-patterns`.
    *   `fastapi-pro` (Nếu dùng xây WebServer Python siêu nhanh).

---

## 5. Tầng Vận Hành & Bảo Mật (DevOps & Security)

**Mục đích**: Đóng gói, kiểm định, tìm lỗi hệ thống, Deploy.

*   **Agents phụ trách**:
    *   `devops-engineer`: Cấu hình Docker, CI/CD, Server, Cloud.
    *   `security-reviewer`: Quét lỗ hổng tĩnh (SAST), lỗi rò rỉ JWT/Key/SQL injection.
    *   `build-error-resolver`: Xem xét Bug biên dịch của toàn dự án.
*   **Skills (Năng lực đính kèm)**:
    *   `docker-patterns`.
    *   `incident-responder`.
    *   `security-scan`.
    *   `server-management`.

---

## 6. Tầng Đảm Bảo Chất Lượng (Quality Assurance - QA)

**Mục đích**: Cứu hộ khi có Bug Runtime hoặc áp dụng TDD (Test-Driven Development).

*   **Agents phụ trách**:
    *   `tdd-guide`: Ép buộc mô hình Viết Test -> Làm Code -> Chạy Pass.
    *   `code-reviewer`: Chấm điểm code style, naming.
    *   `e2e-runner`: Chạy các End-to-End Test.
*   **Skills (Năng lực đính kèm)**:
    *   `debugger` (Systematic Debugging).
    *   `testing-patterns`.
    *   `unit-testing-test-generate`.

---

## 7. Extensions (Module Tùy Biến)

*   `marketing-*`, `seo-*`: Chỉ được trỏ tới nếu User đang làm Website Content/E-commerce và yêu cầu rõ ràng.
*   `gsd-*` (Get Shit Done): Lưu trữ lạnh trong kho `.agent/archive` để tránh làm nhiễu luồng tư duy. Dùng tới chỉ khi gọi rành mạch lệnh GSD.

---

> 💡 **Quy trình chuẩn mực (The Rule of Thumb)**:  
> User ra yêu cầu -> `[Phân tích ngữ cảnh]` -> Nhận dạng yêu cầu thuộc Tầng số mấy? -> Gọi đúng `Agent` tại Tầng đó -> Agent nạp đúng `Skills` của mình thay vì lùng sục toàn kho kỹ năng hệ thống. Dừng lại và hỏi `[NEEDS_HUMAN_INPUT]` nếu mọi thứ mập mờ, thiếu tham số.
