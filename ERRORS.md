# Báo cáo Lỗi Hệ thống (Error Log)

> File này được dùng để ghi log mọi lỗi phát sinh (Syntax, Logic, Runtime, v.v...) nhằm giúp Agent tự học và tránh mắc lại lỗi cũ.

---

## Mẫu Log (Template)
```markdown
## [YYYY-MM-DD HH:MM] - Tiêu đề Lỗi Ngắn Gọn

- **Type**: [Syntax/Logic/Integration/Runtime/Agent/Process]
- **Severity**: [Low/Medium/High/Critical]
- **File**: `path/to/file.extension:line_number`
- **Agent**: [Tên Agent thực hiện]
- **Root Cause**: Mô tả nguyên nhân gốc rễ (1-2 câu)
- **Error Message**: 
  \```
  [Code lỗi hoặc stack trace]
  \```
- **Fix Applied**: Hành động cụ thể đã thực hiện
- **Prevention**: Cách tránh lặp lại lỗi này trong tương lai
- **Status**: [Fixed/Investigating/Deferred]
```
---
