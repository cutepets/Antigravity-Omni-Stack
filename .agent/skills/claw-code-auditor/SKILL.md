---
name: Claw-Code Auditor 
description: Sử dụng `claw-code-parity` bằng Python để audit, trích xuất cấu trúc tool/routing của Claude Code nguyên gốc nhằm khắc phục các điểm nghẽn kiến trúc (deadloop, poor context parsing) cho Antigravity.
---

# Lệnh /claw-code (Auditor)

Đây là Kỹ năng đặc biệt "Cố Vấn Kiến Trúc". Agent được phép kết hợp Skill này cùng kho `c:\Dev2\claw-code` (mô phỏng Python của Claude Code) để tái cấu trúc lại Prompt, hệ thống Tool, hoặc luồng Orchestration nếu phát hiện các lỗ hổng xử lý.

## Trigger Mặc định (Tự Kích Hoạt)

Các Agent (đặc biệt là Orchestrator/Dev3) **PHẢI** nghĩ đến việc triệu hồi skill này khi gặp các dấu hiệu:
1. Có dấu hiệu luồng bị lặp lại vô tận (Infinite Tool Calls Loop) vì Agent hiện tại không chọn đúng Tool để thao tác.
2. Thiết kế một hệ thống đa Agent mới (Cần coi cách chia Job/Process tương đồng chuẩn công nghiệp).
3. Người dùng đánh lệnh `/claw-code` hoặc hỏi về cách Claude Code quản trị file, context.

## Quy Trình Tối Ưu (Parity Auditing Framework)

Nếu nhận lệnh cần chuẩn hóa Tool hoặc tối ưu Routing, hãy làm theo quy trình:

### Cấp 1: Phân tích Cấu trúc (Architectural Sandbox)
Di chuyển nhánh vào kho mô phỏng và tận dụng Python:
```bash
cd c:\Dev2\claw-code
python -m src.main summary
```
> Trích xuất `manifest` và cấu trúc khung (tool counts, command logic) đang được chuẩn hóa.

### Cấp 2: Tìm Kiếm Tham Chiếu (Routing Consultation)
Thay vì tự nghĩ ra trình tự các tool, hãy hỏi Simulator nó sẽ chọn công cụ nào:
```bash
cd c:\Dev2\claw-code
python -m src.main route "<Dán prompt của User đang yêu cầu ở độ phức tạp cao vào đây>"
```
> Đọc danh sách các "Matched commands", "Matched tools" có điểm Score cao nhất. Ghi nhận lại trình tự mà Hệ Thống Lõi yêu cầu.

### Cấp 3: Khám Phá Tool (Tool Reverse-Engineering)
Nếu Agent muốn bắt chước logic định nghĩa (Payload & Responsibility) của một công cụ (như ViewFile, BuildPlan) cho Antigravity:
```bash
python -m src.main show-tool "TênTool"
```
> Trích xuất dòng Schema `responsibility` của Tool đó vào lại Prompt hệ thống của mình để mô tả Tool chuẩn hóa và sắc bén như "hệ thần kinh" bản gốc.

Tất cả các kiến thức thu thập được từ mô phỏng Claw Code này PHẢI được lưu lại vào Workflow, TDD, hoặc `.agent/agents/` để cải tiến tiến trình hệ thống vĩnh viễn.
