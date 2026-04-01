# Phase 8: Codebase Map & README Sync - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase)

<domain>
## Phase Boundary

Tạo codebase map cho `.agent/` directory (STRUCTURE.md + CONVENTIONS.md) và sync README.md với thực tế hiện tại của hệ thống sau Architecture Sprint.
</domain>

<decisions>
## Implementation Decisions

### the agent's Discretion
Tất cả implementation tại đây là infrastructure — agent có toàn quyền quyết định format, cấu trúc, và cách trình bày thông tin.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `.agent/` directory với 16 agents, 344+ skills, 34 workflows, 37 rules
- `README.md` cần update: version, agent count (11→16), architecture table

### Established Patterns
- README dùng markdown với emoji headers, badge shields, table format
- ARCHITECTURE.md đã có — có thể tham khảo làm mẫu

### Integration Points
- `.planning/codebase/` là target output cho codebase map
- `README.md` update trực tiếp tại root
</code_context>

<specifics>
## Specific Ideas

Plan 08-01: Tạo STRUCTURE.md (directory tree + mô tả từng thành phần) và CONVENTIONS.md (naming rules, skill router pattern, agent template format)
Plan 08-02: Update README — badges (11→16 agents), agent table (thêm 5 agents mới), version (3.4.0→5.0)
</specifics>

<deferred>
## Deferred Ideas

None — scope rõ ràng.
</deferred>
