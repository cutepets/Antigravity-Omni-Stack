# 🤖 Antigravity Agent — Danh Sách Lệnh (Slash Commands)

> **Tổng cộng: 86 lệnh** | Cập nhật: 2026-04-02  
> Gõ `/lệnh` trong chat để kích hoạt. Ví dụ: `/plan thêm tính năng đăng nhập Google`

---

## 📋 Mục Lục Nhanh

| Nhóm | Số lệnh |
|------|---------|
| [🗺 Lập Kế Hoạch & Kiến Trúc](#-lập-kế-hoạch--kiến-trúc) | 7 |
| [🏗 Phát Triển Tính Năng](#-phát-triển-tính-năng) | 9 |
| [🐛 Debug & Sửa Lỗi](#-debug--sửa-lỗi) | 5 |
| [✅ Kiểm Thử & Chất Lượng](#-kiểm-thử--chất-lượng) | 6 |
| [🎨 UI/UX & Frontend](#-uiux--frontend) | 4 |
| [🚀 DevOps & Triển Khai](#-devops--triển-khai) | 5 |
| [🔒 Bảo Mật & Compliance](#-bảo-mật--compliance) | 3 |
| [🧠 Quản Lý Bộ Nhớ & Context](#-quản-lý-bộ-nhớ--context) | 7 |
| [🤖 Đa Agent (Multi-Agent)](#-đa-agent-multi-agent) | 6 |
| [📚 Học Hỏi & Tiến Hóa](#-học-hỏi--tiến-hóa) | 8 |
| [🧬 PRP (Product Requirements Pipeline)](#-prp-product-requirements-pipeline) | 5 |
| [🔧 Tiện Ích & Khác](#-tiện-ích--khác) | 21 |

---

## 🗺 Lập Kế Hoạch & Kiến Trúc

| Lệnh | Mô tả | Khi nào dùng |
|------|-------|-------------|
| `/plan` | Lập kế hoạch triển khai từng bước. **CHỜ user xác nhận trước khi code.** | Trước khi bắt đầu bất kỳ tính năng mới nào |
| `/create` | Tạo tính năng/dự án từ A-Z theo 4 phase: PM → Architect → Dev → QA | Khi muốn xây dựng sản phẩm mới hoàn chỉnh |
| `/orchestrate` | Điều phối nhiều agent chạy tuần tự hoặc song song qua tmux/worktree | Khi task quá phức tạp cho 1 agent |
| `/brainstorm` | AI gợi ý ý tưởng theo chuẩn Senior. Khám phá trước khi quyết định. | Khi bí ý tưởng hoặc chưa rõ hướng đi |
| `/status` | Xem dashboard tiến độ dự án: task nào xong, task nào đang làm | Muốn biết dự án đang ở đâu |
| `/prompt-optimize` | Phân tích và tối ưu hóa prompt trước khi chạy. **Không thực thi — chỉ tư vấn.** | Khi muốn viết prompt hiệu quả hơn |
| `/visually` | Vẽ diagram: flowchart, sequence, architecture, mindmap bằng Mermaid | Muốn trực quan hóa logic hoặc kiến trúc |

---

## 🏗 Phát Triển Tính Năng

| Lệnh | Mô tả | Khi nào dùng |
|------|-------|-------------|
| `/create` | Xây tính năng từ đầu: DB schema → API → UI → Docs → Test | Tính năng mới hoàn toàn |
| `/enhance` | Sửa màu, thêm nút, chỉnh logic nhỏ — không cần plan đầy đủ | Tweak nhỏ, không động kiến trúc |
| `/api` | Thiết kế và viết tài liệu API theo chuẩn OpenAPI 3.1 | Xây dựng REST API mới |
| `/realtime` | Tích hợp Socket.io, WebRTC, hoặc SSE cho tính năng realtime | Chat, notification, live updates |
| `/mobile` | Phát triển ứng dụng mobile native (React Native/Expo) | App iOS/Android |
| `/blog` | Hệ thống blog cá nhân hoặc doanh nghiệp với Markdown | Website có bài viết |
| `/portfolio` | Trang portfolio/landing page cá nhân chuyên nghiệp | Trang giới thiệu bản thân |
| `/refactor-clean` | Refactor code sạch hơn theo nguyên tắc Clean Code/SOLID | Code cũ cần làm mới |
| `/tdd` | Viết test trước, code sau — đảm bảo coverage ≥ 80% | Feature mới theo chuẩn TDD |

---

## 🐛 Debug & Sửa Lỗi

| Lệnh | Mô tả | Khi nào dùng |
|------|-------|-------------|
| `/debug` | Phân tích log → tìm root cause → đề xuất fix → verify. Chuyên nghiệp, bài bản. | Gặp lỗi khó sửa, không biết nguyên nhân |
| `/build-fix` | Tự động build và fix lỗi compile/type error | Build fail, TypeScript errors |
| `/log-error` | Ghi lỗi vào `ERRORS.md` để học tập và cải thiện | Sau khi fix bug quan trọng |
| `/aside` | Hỏi nhanh câu hỏi phụ mà không làm mất mạch công việc hiện tại. Auto-resume sau. | Cần giải thích nhanh 1 concept |
| `/explain` | Giải thích code chi tiết, dạy học, chuyển giao kiến thức | Muốn hiểu sâu đoạn code |

---

## ✅ Kiểm Thử & Chất Lượng

| Lệnh | Mô tả | Khi nào dùng |
|------|-------|-------------|
| `/test` | Viết unit test tự động theo chuẩn TDD Master | Cần test cho code mới |
| `/e2e` | Tạo và chạy E2E test với Playwright. Tạo screenshots/videos/traces. | Test user journey đầy cuối |
| `/test-coverage` | Phân tích coverage report và chỉ ra các khu vực thiếu test | Sau khi viết test |
| `/code-review` | Review code uncommitted hoặc GitHub PR. Kiểm tra chất lượng, security. | Trước khi merge |
| `/quality-gate` | Chạy quality checks bắt buộc trước khi release | Chuẩn bị deploy production |
| `/audit` | Kiểm tra toàn diện dự án theo chuẩn Auditor trước bàn giao | Trước khi bàn giao khách |
| `/santa-loop` | 2 reviewer độc lập review song song — cả 2 phải approve mới được ship | Code quan trọng, cần double-check |

---

## 🎨 UI/UX & Frontend

| Lệnh | Mô tả | Khi nào dùng |
|------|-------|-------------|
| `/ui-ux-pro-max` | Thiết kế giao diện premium: glassmorphism, animation, dark mode | Muốn UI đẹp cấp cao |
| `/enhance` | Sửa UI nhỏ: màu sắc, layout, responsive | Tweak giao diện hiện có |
| `/preview` | Bật dev server để xem trước web — mở lên browser ngay | Muốn thấy kết quả thực tế |
| `/performance` | Tối ưu Core Web Vitals, bundle size, lazy loading | Web chạy chậm, muốn tăng tốc |

---

## 🚀 DevOps & Triển Khai

| Lệnh | Mô tả | Khi nào dùng |
|------|-------|-------------|
| `/deploy` | Push lên Vercel/Server. Tự động check env, build, và verify sau deploy. | Code xong, ready để ship |
| `/backup` | `git add` + `git commit` với timestamp tự động. Anti-data-loss. | Trước khi thay đổi lớn |
| `/monitor` | Thiết lập giám sát server, pipeline health, và alerting | Sau khi deploy production |
| `/pm2` | Khởi tạo và cấu hình PM2 process manager cho Node.js | Deploy Node.js app lên VPS |
| `/release-version` | Tự động bump version và đồng bộ tài liệu hệ thống | Chuẩn bị release mới |
| `/setup-pm` | Cấu hình package manager (npm/pnpm/yarn/bun) | Setup dự án mới |

---

## 🔒 Bảo Mật & Compliance

| Lệnh | Mô tả | Khi nào dùng |
|------|-------|-------------|
| `/security` | Quét lỗ hổng: XSS, SQLi, JWT leak, hardcoded secrets, OWASP Top 10 | Trước deploy, sau feature mới |
| `/compliance` | Kiểm tra GDPR, HIPAA, SOC2 compliance | App có user data nhạy cảm |
| `/python-review` | Review code Python: PEP 8, type hints, security, Pythonic idioms | Code Python cần audit |

---

## 🧠 Quản Lý Bộ Nhớ & Context

| Lệnh | Mô tả | Khi nào dùng |
|------|-------|-------------|
| `/context` | **Soi token budget**: scan xem file nào nặng, skill nào thừa, tìm cơ hội tối ưu | Hệ thống chạy chậm, chi phí API cao |
| `/context-budget` | Phân tích context window usage — phiên bản đơn giản hơn `/context` | Muốn overview nhanh |
| `/compact` | **Nén bộ nhớ**: tóm tắt session, lưu snapshot → giải phóng context không mất mạch | Chat quá dài, AI bắt đầu loãng |
| `/save-session` | Lưu toàn bộ trạng thái session vào file có date để dùng sau | Cuối ngày làm việc |
| `/resume-session` | Load session đã lưu và tiếp tục ngay từ chỗ đã dừng | Hôm sau muốn tiếp tục |
| `/checkpoint` | Tạo checkpoint versioned tại thời điểm hiện tại | Trước khi thay đổi lớn, muốn có điểm rollback |
| `/sessions` | Quản lý lịch sử session: list, alias, metadata | Xem lại các session cũ |

---

## 🤖 Đa Agent (Multi-Agent)

| Lệnh | Mô tả | Khi nào dùng |
|------|-------|-------------|
| `/multi-plan` | Lập kế hoạch bằng nhiều model AI cộng tác — đưa ra kế hoạch đồng thuận | Feature phức tạp, cần nhiều góc nhìn |
| `/multi-execute` | Thực thi bằng nhiều model song song | Task có thể chia nhỏ độc lập |
| `/multi-frontend` | Chuyên biệt: nhiều agent cùng làm frontend | Dự án frontend lớn |
| `/multi-backend` | Chuyên biệt: nhiều agent cùng làm backend | Dự án backend lớn |
| `/multi-workflow` | Multi-model collaborative development end-to-end | Dự án full-stack phức tạp |
| `/devfleet` | Orchestrate các Claude Code agent song song qua git worktrees | Dự án enterprise, nhiều module độc lập |
| `/orchestrate` | Điều phối agents tuần tự hoặc song song bằng tmux | Multi-agent workflow thủ công |

---

## 📚 Học Hỏi & Tiến Hóa (AI Self-Learning)

| Lệnh | Mô tả | Khi nào dùng |
|------|-------|-------------|
| `/learn` | Trích xuất pattern tái sử dụng từ session hiện tại | Sau khi giải quyết vấn đề hay ho |
| `/learn-eval` | Trích xuất pattern + tự đánh giá chất lượng trước khi lưu | Version nâng cao của `/learn` |
| `/evolve` | Phân tích instincts và đề xuất cấu trúc tiến hóa | Muốn hệ thống AI tự cải thiện |
| `/instinct-status` | Xem danh sách learned instincts (project + global) kèm confidence | Kiểm tra AI đã học được gì |
| `/instinct-export` | Export instincts ra file | Backup hoặc chia sẻ |
| `/instinct-import` | Import instincts từ file hoặc URL | Thêm knowledge từ nguồn ngoài |
| `/promote` | Nâng instinct từ project-scope lên global scope | Pattern hay, muốn dùng cho mọi project |
| `/prune` | Xóa instincts cũ > 30 ngày chưa dùng | Dọn dẹp knowledge base |
| `/rules-distill` | Scan toàn bộ skills để trích xuất nguyên tắc chung → thành rules | Định kỳ tối ưu hóa hệ thống |
| `/skill-create` | Tạo SKILL.md mới từ git history và pattern của project | Đóng gói quy trình thành skill |
| `/skill-health` | Dashboard sức khỏe toàn bộ skill portfolio | Xem skill nào đang hoạt động tốt |

---

## 🧬 PRP (Product Requirements Pipeline)

> **PRP** = quy trình nặng nhất, dùng cho feature lớn cần artifact đầy đủ

| Lệnh | Mô tả | Khi nào dùng |
|------|-------|-------------|
| `/prp-prd` | Tạo Product Requirements Document đầy đủ với user stories, acceptance criteria | Feature mới cần spec rõ ràng |
| `/prp-plan` | Lập kế hoạch triển khai toàn diện: phân tích codebase + trích xuất pattern | Feature phức tạp cần plan chi tiết |
| `/prp-implement` | Thực thi implementation plan với validation loop nghiêm ngặt | Sau khi có `/prp-plan` |
| `/prp-commit` | Smart commit với message đúng convention từ việc đã làm | Sau khi xong 1 feature |
| `/prp-pr` | Tạo Pull Request với description chuẩn từ implementation | Khi cần tạo PR cho GitHub |

---

## 🔧 Tiện Ích & Khác

| Lệnh | Mô tả | Khi nào dùng |
|------|-------|-------------|
| `/docs` | Tra cứu documentation mới nhất của thư viện qua Context7 | Cần xem API docs, changelog |
| `/document` | Tự động viết docs cho code: README, API docs, JSDoc | Lười viết docs thủ công |
| `/update-docs` | Cập nhật tài liệu hiện có sau khi code thay đổi | Sau khi refactor |
| `/update` | Cập nhật phiên bản Antigravity IDE lên mới nhất | Khi có update hệ thống |
| `/seo` | Tối ưu SEO/GEO: meta tags, structured data, AI search ranking | Muốn lên top Google/ChatGPT |
| `/onboard` | Hướng dẫn người mới vào team tự động | Onboard developer mới |
| `/verify` | Chạy verification checklist trước khi commit hoặc deploy | Quality gate nhẹ, nhanh |
| `/eval` | Đánh giá chất lượng code/agent theo framework chuẩn | Review agent output |
| `/claw` | Khởi động NanoClaw v2 — REPL có model routing, branching, export | Muốn REPL tương tác liên tục |
| `/model-route` | Cấu hình routing: task nào dùng model nào (Opus/Sonnet/Haiku) | Tối ưu chi phí theo task type |
| `/gitnexus-update` | Cập nhật và tích hợp GitNexus vào kiến trúc Antigravity | Sau khi thêm code mới vào codebase |
| `/update-codemaps` | Cập nhật codemap của dự án | Sau khi refactor lớn |
| `/loop-start` | Bắt đầu autonomous loop — AI tự chạy liên tiếp | Tác vụ batch dài |
| `/loop-status` | Xem trạng thái loop đang chạy | Monitor autonomous loop |
| `/harness-audit` | Audit toàn bộ test harness và CI/CD pipeline | Kiểm tra hệ thống CI/CD |
| `/gan-build` | Build qua GAN pipeline | GAN workflow |
| `/gan-design` | Design qua GAN pipeline | GAN design workflow |
| `/projects` | List tất cả project và instinct statistics | Xem tổng quan các dự án |
| `/context-budget` | Phân tích token usage — phiên bản overview | Xem nhanh context |

---

## 📊 Bảng Tham Khảo Nhanh — Theo Tình Huống

| Tình huống | Lệnh phù hợp |
|-----------|-------------|
| Bắt đầu feature mới | `/plan` → `/create` → `/tdd` |
| Gặp bug lạ | `/debug` → `/log-error` |
| Code review trước merge | `/code-review` → `/santa-loop` (nếu quan trọng) |
| Deploy lên production | `/audit` → `/security` → `/deploy` |
| Chat quá dài, AI loãng | `/context` → `/compact` |
| Cuối ngày dừng việc | `/save-session` |
| Hôm sau tiếp tục | `/resume-session` |
| Muốn cải thiện hệ thống | `/learn` → `/evolve` → `/rules-distill` |
| Performance chậm | `/performance` → `/context` (API cost) |
| Tính năng realtime | `/realtime` |
| Mobile app | `/mobile` |
| Viết docs | `/document` → `/update-docs` |
| Tra cứu library | `/docs [tên-library]` |
| Git commit thông minh | `/prp-commit` |
| Tạo Pull Request | `/prp-pr` |

---

## 💡 Tips Sử Dụng

**Kết hợp lệnh hiệu quả:**
```
/plan → xác nhận → /create → /test → /code-review → /deploy
```

**Workflow hàng ngày phổ biến:**
```
Sáng: /resume-session
Chiều: /backup (thường xuyên)
Tối: /save-session
```

**Khi context window đầy:**
```
/context     ← soi xem cái gì nặng
/compact     ← nén lại
tiếp tục bình thường
```

**Phím tắt tinh thần:**
- **Không biết làm sao?** → `/brainstorm`
- **Bắt đầu làm?** → `/plan`
- **Lỗi?** → `/debug`
- **Xong?** → `/backup` → `/deploy`

---

*File này được cập nhật tự động. Xem thư mục `.agent/workflows/` để đọc chi tiết từng lệnh.*
