<!-- Generated: 2026-04-02 | Antigravity v5.0 -->

# CODEMAPS — Index

> Token-lean architecture documentation cho AI agents.
> Mục đích: load nhanh, hiểu nhanh cấu trúc hệ thống mà không tốn context.

## Files

| File | Nội dung | Token est. |
|------|---------|-----------|
| [architecture.md](./architecture.md) | System boundary, data flow, entry points | ~900 |
| [agents.md](./agents.md) | 16 agents: model, skills, routing logic | ~750 |
| [workflows.md](./workflows.md) | 86 slash commands theo category | ~700 |
| [rules.md](./rules.md) | 37 rules: baseline cost, conditional triggers | ~600 |
| [skills.md](./skills.md) | 357 skills theo domain cluster | ~500 |
| [dependencies.md](./dependencies.md) | MCP servers, external services, integrations | ~400 |

**Total codemap size: ~3,850 tokens** (vs reading raw files: ~50,000+ tokens)

## Quick Lookup

**"Agent nào xử lý task này?"** → [agents.md](./agents.md) > Routing Logic  
**"Lệnh nào dùng cho X?"** → [workflows.md](./workflows.md) > By Category  
**"Cái gì đang ngốn token?"** → [rules.md](./rules.md) > Always-Loaded Rules  
**"MCP server nào available?"** → [dependencies.md](./dependencies.md) > MCP Servers  
**"Skill nào cover domain X?"** → [skills.md](./skills.md) > Domain Clusters  

## Freshness

Chạy `/update-codemaps` sau khi:
- Thêm agent mới
- Thêm workflow mới  
- Thêm MCP server
- Refactor lớn thay đổi routing

**Last updated:** 2026-04-02 by `/update-codemaps` workflow
