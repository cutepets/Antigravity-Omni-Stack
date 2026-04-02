# 🚀 Antigravity Omni-Stack — Agent Framework

<div align="center">

**Version:** `5.0.0` · **Engine:** Antigravity IDE + MCP · **Security Grade:** `A (100/100)` · **Framework:** ECC v2.0

[![AgentShield](https://img.shields.io/badge/AgentShield-A%20100%2F100-brightgreen?style=flat-square&logo=shield)](./.agent/)
[![Agents](https://img.shields.io/badge/Agents-17%20Core-blue?style=flat-square)](./.agent/agents/)
[![Skills](https://img.shields.io/badge/Skills-344-purple?style=flat-square)](./.agent/skills/)
[![License](https://img.shields.io/badge/License-MIT-gray?style=flat-square)](./LICENSE)
[![Changelog](https://img.shields.io/badge/Changelog-v5.0-orange?style=flat-square)](./CHANGELOG.md)

</div>

**Antigravity Omni-Stack** là mô hình Multi-Agent AI Coding Framework được vận hành dưới sự chỉ huy của Orchestrator (Dev3) và 17 Specialist Agents. Thay vì sử dụng một trợ lý lập trình chung chung, hệ thống này thiết kế theo kiến trúc "Divide & Conquer" (Chia để trị): Agent là những thực thể "mỏng" (Thin Agent) với bản sắc riêng, tùy gọi và triển khai các "Kỹ năng chuyên sâu" (Rich Skills).

Dưới đây là kiến trúc và tài nguyên tổng thể của hệ thống.

---

## 🔒 Security Score (AgentShield)

**Điểm bảo mật hiện tại:** `Grade A (100/100)`
**Công cụ quét:** `npx ecc-agentshield scan --path .agent`

- **Secrets (100/100):** Không phát hiện Hardcoded Secret. An toàn tuyệt đối với tệp `.env`.
- **Permissions (100/100):** Đã tuân thủ triệt để nguyên tắc Least Privilege (Xóa bỏ cấp quyền tùy ý đồng thời Bash/Edit/Write).
- **Hooks (100/100):** Hệ thống chặn tự động `PreToolUse`, `AfterTool`, và `Stop`.
- **Đánh giá:** Hệ thống đã hoàn toàn sẵn sàng cho môi trường Production (Enterprise-ready) và khả năng chặn đứng hoàn toàn việc AI bị lợi dụng qua lỗ hổng Prompt Injection.

---

## 📦 What's Inside

Hệ thống được cấu trúc xoay quanh các cơ chế động quyền lực nhất của Everything Claude Code (ECC v2.0):
- **17 Chuyên gia ảo (Core Agents):** Chia nhau phụ trách từ code, QA, đến bảo mật và Devops.
- **344 Kỹ năng (Skills):** Các logic chuyên sâu được "lắp ghép" vào Agent khi cần, tránh ngốn Tokens.
- **84 Slash Commands (Workflows):** Luồng vận hành rập khuôn để đảm bảo các tiến trình được thực hiện chính xác và tự động.
- **37 Bộ nguyên tắc (Rules/Constitution):** Tôn chỉ thiết kế nhằm rèn luyện AI luôn tư duy như Senior Engineer/Architect.

---

## 🤖 Agents

Hệ thống sở hữu đội ngũ 17 Core Agents được phân loại hóa để thực thi nhiệm vụ song song.

- **`ai-orchestrator` & `product-manager`:** Điều phối viên cấp cao, phân nhiệm vụ, theo dõi dòng chảy dự án, đánh giá rủi ro, và phác thảo Roadmap.
- **`frontend-specialist` & `backend-specialist`:** Hai chủ lực gánh vác việc dựng cấu trúc, áp dụng Pattern và thực thi logic tính năng.
- **`database-architect` & `system-architect`:** Thiết kế schema, lập biểu đồ C4, xử lý hiệu năng truy vấn và Microservices.
- **`security-auditor` & `qa-engineer`:** Song sát đảm bảo TDD (Test-Driven Development), kiểm thử E2E Playwright và rà soát mọi truy cập trái phép.
- **`debug-specialist`:** Chuyên gia chẩn đoán hệ thống, Trace Bug và xử lý Error Diagnostics tận gốc.
- **`devops-engineer`:** Tối ưu hóa hạ tầng CI/CD, Containerization, Kubernetes và cấu hình Vercel/Cloud.
- **Đánh giá & Giải thích:** Sự phân tách (Decoupling) này là chìa khóa chống quá tải Context Window. Mỗi Agent chỉ làm việc thuộc chuyên môn, làm tăng tính chính xác của phản hồi và loại bỏ sự "ảo giác" (hallucination) khi code.

---

## 🧩 Skills

Thư viện **344 Skills** là kho trí tuệ chuyên sâu (Deep Methodology).

- **Architecture & Design:** `c4-master`, `domain-driven-hexagon`, `microservices-patterns`, v.v định nghĩa cách phân rã hệ thống.
- **Testing & QA:** `tdd-master-workflow`, `e2e-testing`, `eval-harness` giúp thực thi triệt để Test-first.
- **Frontend & UI:** `nextjs-master`, `react-master`, `tailwind-patterns`, `ui-ux-pro-max-skill` lo phần tối ưu UX và Micro-Animation.
- **Backend & APIs:** `nestjs-expert`, `agent-backend-patterns`, `bullmq-specialist`, `trpc`, `api-design`.
- **Đánh giá & Giải thích:** Bằng cách biến các kĩ năng thành Modules (Lazy-loading), AI không phải ghi nhớ tất cả. Khi gặp Task liên quan, Agent chỉ cần nạp tệp SKILL.md tương ứng.

---

## 🔄 Workflow & Safety

Antigravity đề cao sự vận hành chặt chẽ dựa theo chu trình PDCA (`/plan` → `/create` → `/orchestrate` → `/status`).

- **Quy trình:** Khi user giao việc, AI không Code ngay. Nó phải thông qua `brainstorm`, báo cáo tại `implementation_plan.md`, đợi cấp quyền từ Người dùng rồi mới phân chia Ticket sang `task.md`.
- **Đánh giá & Giải thích:** Flow tuần tự giúp theo dõi tiến độ công việc, đảm bảo không một file nào bị thay thế nhầm, phòng tránh được rủi ro vòng lặp (vicious loop).

---

## 🖧 Backend

- **Nền tảng:** Phù hợp hoàn hảo với **Next.js API**, **NestJS**, **Node.js** và chạy message queue với **Moleculer**.
- **Database:** PostgreSQL / Prisma / Clickhouse.
- **Cơ chế:** Ưu tiên Domain-Driven Design (DDD), phân tầng Layer (Controller - Service - Repository), thiết kế RESTful hoặc GraphQL tối ưu truy xuất và có rate-limiting/bảo mật JWT chặn đầu.

---

## 🎨 Frontend

- **Nền tảng:** React / Next.js app router.
- **Tối ưu:** Quản lý State rõ ràng, Component linh hoạt (Component-driven), áp dụng triết lý SSR/SSG.
- **Giải thích:** Cấu trúc frontend được chuẩn hóa không chỉ để Code đẹp, mà để "Performance-focused" — tối giản Bundle size và đạt chuẩn Core Web Vitals xanh.

---

## 🎭 Design & UX

- **Nguyên tắc:** Loại bỏ hoàn toàn sự nhàm chán (cliché). Yêu cầu bắt buộc phải đẹp ngay từ cái nhìn đầu tiên (Premium Visuals).
- **Hệ sinh thái:** Dùng Vanilla CSS linh hoạt hoặc TailwindCSS (v4) dựa theo hệ thống Design System (Design Tokens). Hỗ trợ Glassmorphism, Liquid Glass design, chế độ Dark Mode tinh tế và Micro-animations tăng Tương tác.
- **Đánh giá:** Sự chỉn chu về thẩm mỹ biến các app từ MVP nghèo nàn thành các sản phẩm mang độ hoàn thiện chuẩn Enterprise-class.

---

## ⚡ Workflows / Slash Commands

Hàng loạt các phím tắt `/` (gõ vào khung chat AI) giúp User "triệu hồi" những chuỗi hành động chuyên nghiệp:
- `/plan`: Lập bản đồ tính năng một cách cẩn trọng.
- `/create`: Khởi tạo luồng tính năng mới với đa Agent.
- `/audit`: Rà soát mã độc, phân tích code thối (code smell).
- `/tdd`: Code theo chế độ buộc viết Test trước.
- `/e2e`: Viết kịch bản tự động testing Playwright.
- `/ui-ux-pro-max`: Buff giao diện cực xịn xò.
- **Giải thích:** Tiết kiệm hàng giờ đồng hồ viết lại prompt cho User. Mỗi lệnh kích hoạt một chuỗi hành vi được tinh chỉnh đến mức tối đa hóa hiệu suất AI.

---

## 📜 Rules

37 quy tắc hiến pháp được giám sát 24/7.
- `GEMINI.md`: Bản ngã cốt lõi điều phối 16 Agent.
- `security.md`: Cấm tuyệt đối Hardcode, SQL Injection, XSS.
- `runtime-watchdog.md`: Luật chống treo bộ nhớ, ép AI báo cáo lỗi và phải tự phân tích "Vì sao đoạn code hỏng".
- **Đánh giá:** Đây là "chốt chặn lương tâm" bắt AI phải phục vụ theo phong thái C-Level (CTO / Lead), không thỏa hiệp với mã nguồn bẩn.

---

## 🪝 AI-Triggered Hooks

Những tập lệnh bảo vệ chạy tự động hoàn toàn (bên trong `.agent/hooks/`):
- `gsd-prompt-guard.js`: Chặn luồng nếu AI xuất lệnh CLI nguy hiểm trước khi gọi bash/write.
- `gsd-workflow-guard.js`: Chặn ghi/sửa file nếu nằm trong vùng Cấm thư mục quan trọng chưa backup.
- `gsd-context-monitor.js`: Hook gỡ token chết (Rác log) để tiết kiệm Context Window.
- **Đánh giá & Giải thích:** Các Hooks tạo nên thành tựu Security Score 100/100, bù trừ các rủi ro hệ thống bị chọc phá (Prompt Injection). AI bị đặt trong "Sandbox giới hạn bảo vệ" mạnh mẽ.

---

## ☁️ DevOps & Reliability

- **Công cụ:** Triển khai hạ tầng Vercel deploy, GCP Cloud Run, Kubernetes, Docker. Trạng thái System có log lỗi ghi rõ ràng tại `ERRORS.md`.
- **Hành vi SRE (Site Reliability Engineering):**
  - Mọi lỗi Crash được xử lý theo RCA (Root Cause Analysis).
  - Tự động Backup session.
- **Đánh giá:** Giúp môi trường của bạn luôn vận hành trong sự ổn định, sẵn sàng Scale-up tự do trong Monorepo (Nx / Turborepo / Bazel).

---

## 🚀 Project Setup & Onboarding

1. **Chuẩn bị môi trường:** 
   Sử dụng lệnh `npm install` để chạy các gói package. Cấu trúc GitNexus (đóng vai trò System Context mapping) đã được tích hợp (`npm run gitnexus-update`).
2. **Quét bảo mật Agent cấu hình (Security Audit):** 
   Chạy `npm run scan:agent` định kì để xác thực cấu trúc cấu hình AI.
3. **Gọi AI Thực thi:** 
   Không bao giờ điều khiển các lệnh Workflow cài đặt ra màn hình Terminal hệ điều hành mà gán các Slash Commands (Bắt đầu bằng `/`) vào trong Box Chat IDE AI (VD: Gõ `/plan Thêm cổng thanh toán Stripe`). AI sẽ tự động kích hoạt Agent-Role.
4. **Theo dõi:** 
   Check `task.md` (Checklist) và `implementation_plan.md` cho các tác vụ thay đổi chuyên sâu. Dọn rác Context Window khi làm việc lâu qua lệnh `/compact`.

> **Antigravity Omni-Stack** — Everything Claude Code, Scale To Enterprise.
