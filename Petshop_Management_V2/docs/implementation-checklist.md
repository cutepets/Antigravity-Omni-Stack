Dưới đây là bản implementation checklist theo kiểu chia commit nhỏ, để mở phiên mới là làm tuần tự được ngay.

Nguyên Tắc

Mỗi commit chỉ xử lý 1 mục tiêu rõ.
Ưu tiên commit “không đổi hành vi” trước, rồi mới commit “đổi layout / UX”.
Sau mỗi commit chạy pnpm --filter @petshop/web type-check.
Sau mỗi phase lớn chạy gitnexus_detect_changes(scope:"all").
Commit 1: Tạo khung module order/
Mục tiêu: dựng thư mục con để chứa logic Orders giống receipt.

Tạo file:

apps/web/src/app/(dashboard)/orders/_components/order/order.types.ts
apps/web/src/app/(dashboard)/orders/_components/order/order.constants.ts
apps/web/src/app/(dashboard)/orders/_components/order/order.utils.ts
Việc làm:

Move type nội bộ ra order.types.ts
Move badge/label/action map ra order.constants.ts
Move helper pure function ra order.utils.ts
Tiêu chí xong:

order-workspace.tsx import từ 3 file mới
Không đổi UI, không đổi hành vi
Tên commit gợi ý:

refactor(orders): extract order types constants and utils
Commit 2: Tách hook use-order-workspace
Mục tiêu: kéo state/query/mutation ra khỏi component lớn.

Tạo file:

apps/web/src/app/(dashboard)/orders/_components/order/use-order-workspace.ts
Việc làm:

Move toàn bộ:
useState
useQuery
useMutation
permission check
derived totals/status/action flags
handlers handleSave, addCatalogItem, buildPayload, buildDraftFromOrder
order-workspace.tsx chỉ nhận object trả về từ hook
Tiêu chí xong:

UI y nguyên
order-workspace.tsx giảm mạnh dung lượng
Không còn mutation/query lớn nằm trong component render
Tên commit:

refactor(orders): extract order workspace hook
Commit 3: Tách header thành file riêng
Mục tiêu: tách phần top bar cho dễ chỉnh giống receipt.

Tạo file:

apps/web/src/app/(dashboard)/orders/_components/order/order-header.tsx
Việc làm:

Move phần PageHeader
Props hóa:
mode
title
isEditing
pendingAction
onBack
onEdit
onSave
Tiêu chí xong:

Header render giống cũ
Logic nút không đổi
Tên commit:

refactor(orders): extract order header
Commit 4: Tách panel khách hàng / thông tin chung
Mục tiêu: gom phần Chi nhánh, Khách hàng, Chiết khấu, Phí ship, Ghi chú.

Tạo file:

apps/web/src/app/(dashboard)/orders/_components/order/order-customer-panel.tsx
Việc làm:

Move toàn bộ khối activeTab === 'info' phần form chính
Split props cho:
branch
customer search
customer selected
discount
shipping
notes
editable state
Tiêu chí xong:

Mode create/detail/edit vẫn hoạt động
Chưa đổi layout lớn
Tên commit:

refactor(orders): extract customer and order info panel
Commit 5: Tách panel tổng quan đơn
Mục tiêu: phần Tổng quan đơn hàng và Thông tin khách hàng/detail card tách riêng.

Tạo file:

apps/web/src/app/(dashboard)/orders/_components/order/order-overview-panel.tsx
Việc làm:

Move các card:
tổng quan
thông tin khách hàng detail
mã đơn / người tạo / chi nhánh
Tiêu chí xong:

info tab chỉ còn compose 2 panel
Không đổi business logic
Tên commit:

refactor(orders): extract order overview cards
Commit 6: Tách ô tìm kiếm item
Mục tiêu: phần search sản phẩm/dịch vụ riêng khỏi bảng item.

Tạo file:

apps/web/src/app/(dashboard)/orders/_components/order/order-search-panel.tsx
Việc làm:

Move input search
Move dropdown suggestion products/services
Props hóa:
itemSearch
setItemSearch
productMatches
serviceMatches
onAddCatalogItem
isEditing
Tiêu chí xong:

Search và add item vẫn như cũ
Bảng item chưa tách
Tên commit:

refactor(orders): extract item search panel
Commit 7: Tách bảng item
Mục tiêu: phần bảng sản phẩm/dịch vụ thành file riêng.

Tạo file:

apps/web/src/app/(dashboard)/orders/_components/order/order-items-table.tsx
Việc làm:

Move list item rows
Props hóa:
items
isEditing
onChangeQuantity
onChangeUnitPrice
onRemoveItem
Chuẩn bị chỗ để sau này layout giống receipt hơn
Tiêu chí xong:

Tab items render qua component riêng
Tất cả thao tác quantity/price/remove vẫn đúng
Tên commit:

refactor(orders): extract items table
Commit 8: Tách action sidebar
Mục tiêu: panel Xử lý sang file riêng.

Tạo file:

apps/web/src/app/(dashboard)/orders/_components/order/order-actions-panel.tsx
Việc làm:

Move các nút:
tạo/lưu
hủy sửa
thu tiền
duyệt đơn
xuất kho
quyết toán
hủy đơn
mở POS
Props hóa callback và visibility flags
Tiêu chí xong:

Logic enable/disable nút không đổi
JSX của workspace gọn đi rõ rệt
Tên commit:

refactor(orders): extract actions panel
Commit 9: Tách payment summary
Mục tiêu: phần Trạng thái thanh toán thành panel riêng.

Tạo file:

apps/web/src/app/(dashboard)/orders/_components/order/order-payment-summary.tsx
Việc làm:

Move card:
payment status
amount paid
remaining amount
Tiêu chí xong:

Detail page sidebar rõ hơn
Không đổi dữ liệu
Tên commit:

refactor(orders): extract payment summary panel
Commit 10: Tách timeline
Mục tiêu: phần Lịch sử phiên bản thành file riêng.

Tạo file:

apps/web/src/app/(dashboard)/orders/_components/order/order-timeline.tsx
Việc làm:

Move timeline render
Dùng constant labels từ order.constants.ts
Tiêu chí xong:

Detail page vẫn hiển thị timeline đúng
Không còn map timeline trực tiếp trong workspace
Tên commit:

refactor(orders): extract order timeline
Commit 11: Dọn lại order-workspace.tsx thành shell
Mục tiêu: file này chỉ compose layout như receipt.

Việc làm:

order-workspace.tsx chỉ còn:
gọi use-order-workspace
render OrderHeader
render left panels / right panels
render modal
Xóa code helper còn sót trong file
Tiêu chí xong:

File xuống mức dễ đọc
Tách trách nhiệm rõ
Tên commit:

refactor(orders): reduce workspace to layout shell
Commit 12: Chuẩn hóa mode create/detail/edit
Mục tiêu: semantics sạch hơn, giống receipt.

Việc làm:

Giữ route:
/orders/new
/orders/[id]
Dùng:
mode=create
mode=detail
isEditing nội bộ
Dọn điều kiện rải rác trong panel/hook theo 1 chuẩn chung
Tiêu chí xong:

Không cần route edit riêng
detail -> chỉnh sửa -> lưu/hủy mượt
Tên commit:

refactor(orders): normalize create detail and edit modes
Commit 13: Chuẩn hóa business rule action
Mục tiêu: gom logic status machine.

Việc làm:

Tạo helper trong use-order-workspace.ts hoặc order.utils.ts:
canApproveCurrentOrder
canExportCurrentOrder
canSettleCurrentOrder
canPayCurrentOrder
isOrderReadonly
Bám rule:
PENDING -> approve
CONFIRMED -> export stock
PROCESSING -> pay / settle
COMPLETED/CANCELLED -> readonly
Tiêu chí xong:

Action panel không chứa điều kiện dài
Dễ test và dễ maintain
Tên commit:

refactor(orders): centralize order action rules
Commit 14: Tách print utility
Mục tiêu: đưa logic in hóa đơn ra ngoài component.

Tạo file:

apps/web/src/app/(dashboard)/orders/_components/order/order-print.ts
Việc làm:

Tạo hàm:
printOrderA4
printOrderK80
printOrderPdf nếu cần
Chuẩn hóa dữ liệu print:
customer
branch
item list
total
paid
remaining
status
Tiêu chí xong:

Không có HTML print inline trong workspace
Có thể tái dùng ở list/detail
Tên commit:

feat(orders): extract order invoice print helpers
Commit 15: Gắn menu In / Xuất hóa đơn vào header
Mục tiêu: UX tương tự receipt.

Sửa file:

order-header.tsx
có thể thêm order-print-menu.tsx nếu cần
Việc làm:

Thêm action:
In A4
In K80
Xuất PDF
Chỉ hiện ở detail hoặc sau khi create thành công
Tiêu chí xong:

Header có menu in
Không đụng action nghiệp vụ
Tên commit:

feat(orders): add invoice print actions to header
Commit 16: Dọn modal trùng chức năng
Mục tiêu: loại duplicate trong modal orders.

Rà file:

order-settlement-modal.tsx
Việc làm:

Quyết định giữ 1 file
Update import toàn bộ caller
Xóa file dư nếu xác nhận không dùng
Tiêu chí xong:

Chỉ còn 1 modal settlement
Không import lẫn lộn
Tên commit:

refactor(orders): remove duplicate settlement modal
Commit 17: Dọn order-list.tsx cho khớp workspace mới
Mục tiêu: list và workspace cùng ngôn ngữ UI.

Việc làm:

CTA rõ:
Tạo đơn nhiều bước
POS bán nhanh
Nếu cần thêm quick actions theo status:
xem chi tiết
in
thu tiền
Giữ list chỉ làm list, không mang logic detail
Tiêu chí xong:

/orders chỉ là dashboard danh sách
điều hướng sang workspace rõ ràng
Tên commit:

refactor(orders): align order list with workspace flow
Commit 18: Layout pass theo mẫu receipt
Mục tiêu: đổi bố cục cuối cùng giống receipt.

Việc làm:

Left column:
header phụ
customer/info panel
search panel
items table
Right column:
summary
actions
payment summary
timeline
Đồng bộ spacing, border, card hierarchy
Tiêu chí xong:

Orders nhìn cùng hệ với receipt
Chỉ khác nghiệp vụ, không khác cấu trúc lớn
Tên commit:

feat(orders): redesign workspace layout to match receipt pattern
Commit 19: Cleanup import từ POS
Mục tiêu: giảm coupling nếu cần.

Việc làm:

Rà usePosProducts, usePosServices, useCustomerSearch, useBranches
Nếu hợp lý:
move sang shared query hook cho Orders
Nếu chưa cần:
giữ nguyên nhưng ghi rõ dependency
Tiêu chí xong:

Biết rõ Orders đang dùng shared query nào từ POS
Không còn “mượn tạm” mơ hồ
Tên commit:

refactor(orders): clarify shared query dependencies
Commit 20: Final cleanup
Mục tiêu: chốt codebase sạch.

Việc làm:

xóa dead code
xóa constant/helper cũ trong order-workspace.tsx
rà encoding/import/path
chạy:
pnpm --filter @petshop/web type-check
gitnexus_detect_changes(scope:"all")
Tên commit:

chore(orders): cleanup workspace refactor leftovers
Checklist Mỗi Commit

 Chỉ sửa 1 nhóm mục tiêu
 type-check pass
 Không làm đổi behavior ngoài phạm vi commit
 Nếu sửa symbol lớn, đã nhìn impact trước
 Diff đọc được, không lẫn refactor và redesign trong cùng commit
