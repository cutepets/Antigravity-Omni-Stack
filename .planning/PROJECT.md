# Antigravity Omni-Stack — Agent Framework

## What This Is

Antigravity Omni-Stack là một **Multi-Agent AI Coding Framework** nội bộ được thiết kế cho toàn bộ vòng đời phát triển phần mềm — từ thiết kế, code, test, bảo mật đến vận hành. Hệ thống hoạt động theo kiến trúc **Thin Agent + Rich Skills**: mỗi agent nhỏ gọn (~2K chars) giữ identity và định hướng, còn toàn bộ methodology nặng được deferred vào Skills tải theo yêu cầu.

## Core Value

**"Một Agent chuyên nghiệp hơn 10 Agent biết hết"** — Ưu tiên độ chuyên sâu per-agent và zero skill overlap hơn số lượng agent.

## Requirements

### Validated

- ✓ 16 Core agents với phân vùng skill rõ ràng — Phase Architecture v4.2.0
- ✓ 344 Skills ánh xạ không trùng lặp qua Regex Router
- ✓ Security Grade A (97/100) — AgentShield scan
- ✓ Rules Engine với trigger: glob / model_decision (Token-efficient)
- ✓ Hooks: Prompt Guard + Context Monitor + Workflow Guard — active

### Active

- [ ] GSD Autonomous Loop tích hợp hoàn chỉnh với `.planning/` structure
- [ ] README.md phản ánh đúng 16 agents (hiện còn ghi 11)
- [ ] Codebase map cho `.agent/` (CONVENTIONS.md, STRUCTURE.md)
- [ ] Skill health check: verify tất cả 344 skills còn accessible

### Out of Scope

- Giao diện người dùng (UI) — Đây là framework-only, không có frontend
- Database tích hợp trực tiếp — Agents dùng PostgreSQL MCP khi cần, không hardcode
- External deployment pipeline — focus là local IDE workflow

## Context

- **Engine**: Antigravity IDE (Gemini/Claude Sonnet 4.6 Thinking)
- **Framework**: Everything Claude Code (ECC) v2.0
- **State**: Phase Architecture đã hoàn thành (Phase 4-7). GSD vừa được khởi tạo.
- **Key Infrastructure**: GitNexus index (46 symbols), MCP servers (GitHub, NotebookLM, Stitch)

## Constraints

- **Token Budget**: Rules phải dùng `model_decision` thay `always_on` khi có thể — context window là tài nguyên khan hiếm
- **No Hardcode Paths**: Tất cả path reference qua `.agent/` hoặc biến môi trường
- **Security**: Không bao giờ commit secret; deny rules phải luôn active trong settings.json

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 16 agents thay vì 26 | 26 agents tạo conflict và skill drought | ✓ Good |
| Regex Router phân bổ skills | Tự động, không cần maintain thủ công | ✓ Good |
| GSD `.planning/` tách biệt `.agent/` | GSD quản lý state, ECC quản lý logic | — Pending |
| Hooks trỏ về `.agent/settings.json` | Legacy `.planning/config.json` không tồn tại | ✓ Good |

---
*Last updated: 2026-04-02 after GSD initialization*
