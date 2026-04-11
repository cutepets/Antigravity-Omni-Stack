# Hướng dẫn triển khai `receipt-workspace` dùng chung cho phiếu nhập

Tài liệu này dùng để giao cho Gemini triển khai theo từng bước. Mục tiêu là dựng một giao diện nhập hàng dùng chung cho cả `Tạo phiếu nhập`, `Chi tiết phiếu nhập`, và `Cập nhật phiếu nhập`, nhưng **phase 1 chỉ cần hoàn thiện phần tạo phiếu trước** rồi mới mở đường cho các màn còn lại.

## 1. Mục tiêu cuối cùng

Tạo một workspace thống nhất cho nghiệp vụ phiếu nhập, đảm bảo:

- Một giao diện dùng chung cho cả tạo mới, xem chi tiết, và cập nhật.
- Trải nghiệm nhập hàng và xử lý đơn nhập đồng bộ, nhất quán.
- Các thao tác nghiệp vụ theo đúng giai đoạn:
  - Tạo đơn.
  - Sửa đơn, thanh toán, nhập kho, hủy.
  - Hoàn hàng khi đơn đã hoàn thành.
- Giao diện hiển thị tiếng Việt có dấu, đúng chuẩn UI ứng dụng.
- Trang cố định chiều cao, chỉ danh sách sản phẩm trong đơn hoặc lịch sử dài mới cuộn.

## 2. Hiện trạng code cần nắm

Các màn hiện tại đang nằm ở:

- `Petshop_Management_V2/apps/web/src/app/(dashboard)/inventory/receipts/new/page.tsx`
- `Petshop_Management_V2/apps/web/src/app/(dashboard)/inventory/receipts/_components/create-receipt-form.tsx`
- `Petshop_Management_V2/apps/web/src/app/(dashboard)/inventory/receipts/[id]/page.tsx`
- `Petshop_Management_V2/apps/web/src/app/(dashboard)/inventory/receipts/[id]/_components/receipt-detail.tsx`
- `Petshop_Management_V2/apps/web/src/app/(dashboard)/inventory/receipts/page.tsx`
- `Petshop_Management_V2/apps/web/src/app/(dashboard)/inventory/receipts/_components/receipt-list.tsx`

API đang có sẵn:

- `GET /stock/receipts/:id`
- `POST /stock/receipts`
- `PUT /stock/receipts/:id`
- `PATCH /stock/receipts/:id/pay`
- `POST /stock/receipts/:id/payments`
- `PATCH /stock/receipts/:id/receive`
- `POST /stock/receipts/:id/receivings`
- `POST /stock/receipts/:id/close`
- `POST /stock/receipts/:id/returns`
- `POST /stock/returns/:id/refunds`

File API frontend:

- `Petshop_Management_V2/apps/web/src/lib/api/stock.api.ts`

## 3. Phạm vi phase 1

Phase 1 chỉ làm 2 việc:

1. Dựng một `receipt-workspace` dùng chung cho layout.
2. Chuyển màn `Tạo phiếu nhập` sang dùng layout đó.

Không cần làm xong toàn bộ chi tiết/cập nhật ngay trong phase 1. Mục tiêu của phase 1 là tạo đúng “khung” giao diện để các phase sau cắm logic vào mà không phải đập đi làm lại.

## 4. Cấu trúc UI mong muốn

### 4.1 Thanh trên cùng

Thanh ngang phía trên phải chứa:

- Thông tin nhà cung cấp.
- Các nút thao tác.
- Timeline đơn hàng.
- Trạng thái đơn.

Thanh này nên sticky hoặc cố định trong viewport để người dùng luôn thấy ngữ cảnh hiện tại.

### 4.2 Cột trái

Tab dọc bên trái gồm:

- Tìm sản phẩm.
- Bên dưới là danh sách sản phẩm trong đơn.
- Có tích chọn hàng loạt.

### 4.3 Cột phải

Tab dọc bên phải gồm:

- Thông tin thanh toán.
- Lịch sử đơn hàng và thao tác gộp chung, không cần tách thành nhiều khối rời.

### 4.4 Quy tắc cuộn

- Toàn trang cố định chiều cao.
- Không cho toàn bộ page cuộn lung tung.
- Chỉ để danh sách sản phẩm trong đơn hoặc lịch sử cuộn.
- Các vùng còn lại giữ cố định để thao tác nhanh.

## 5. Quy tắc nghiệp vụ cần thể hiện trên UI

### 5.1 Các giai đoạn thao tác

1. Tạo đơn.
2. Sửa đơn, thanh toán, nhập kho, hủy.
3. Hoàn hàng khi đơn đã hoàn thành.

### 5.2 Hành vi của từng nút

- `Thanh toán`: mở cửa sổ nhập số tiền và hình thức thanh toán.
- `Nhập kho`: chỉ hiện khi đã xác nhận đủ.
- `Hủy`: chỉ cho khi chưa có phát sinh chặn lại nghiệp vụ.
- `Hoàn hàng`: chỉ hiện khi đã thanh toán xong và nhập kho xong, đơn ở trạng thái `Hoàn thành`.

### 5.3 Trạng thái cần có

- `Đặt đơn`
- `Đã thanh toán`
- `Thanh toán 1 phần`
- `Nhận hàng`
- `Nhận hàng 1 phần`
- `Hoàn thành`

Lưu ý: backend hiện có trạng thái kỹ thuật riêng như `DRAFT`, `PARTIAL_RECEIVED`, `FULL_RECEIVED`, `SHORT_CLOSED`, `PAID`, `PARTIAL`. UI cần map lại sang ngôn ngữ nghiệp vụ thân thiện hơn.

## 6. Cách triển khai phase 1, từng bước

### 6.1 Lộ trình làm chuẩn

Lộ trình nên đi theo đúng thứ tự này:

1. Tách `receipt-workspace` dùng chung, giữ lại phần mạnh nhất của màn tạo hiện tại.
2. Làm xong màn `Tạo đơn` mới trước, chỉ lưu nháp.
3. Chuyển màn chi tiết sang cùng shell đó.
4. Bật `mode edit` cho phiếu nháp.
5. Thêm các modal `Thanh toán`, `Nhập kho`, `Hoàn hàng`.
6. Chuẩn hóa toàn bộ label tiếng Việt có dấu và rà encoding UTF-8 trong các chuỗi đang có dấu hiệu lỗi hiển thị.

### Bước 1: Đọc lại hiện trạng và chốt kiến trúc

Trước khi code, xác định rõ:

- Màn `Tạo phiếu nhập` đang là màn chính để giữ lại logic nhập hàng.
- Màn `Chi tiết phiếu nhập` hiện đang là màn xem tách riêng.
- Phase 1 chỉ cần tạo một shell/layout dùng chung, chưa cần hợp nhất toàn bộ luồng.

### Bước 2: Tạo component `receipt-workspace`

Nên tạo một component mới, ví dụ:

- `Petshop_Management_V2/apps/web/src/app/(dashboard)/inventory/receipts/_components/receipt-workspace.tsx`

Component này nên nhận props để layout không bị cứng:

- `header`
- `leftPanel`
- `rightPanel`
- `mainPanel`
- `actions`
- `status`
- `timeline`
- `mode`

Mục tiêu của component này:

- Giữ khung bố cục chung.
- Không chứa business logic cụ thể.
- Tái sử dụng cho tạo mới, chi tiết, cập nhật ở phase sau.

### Bước 3: Bọc màn tạo phiếu vào workspace mới

Giữ nguyên logic hiện tại của `CreateReceiptForm`, nhưng thay phần JSX gốc bằng workspace mới.

Nguyên tắc:

- Không làm vỡ flow tạo phiếu hiện có.
- Không thay đổi API create ngay ở phase 1.
- Không làm mất các phần tìm sản phẩm, chọn NCC, bảng dòng hàng, tổng tiền, ghi chú.

### Bước 4: Chia lại bố cục cho đúng yêu cầu

Khi gắn vào `receipt-workspace`, cần map lại như sau:

- Top bar: thông tin nhà cung cấp + nút thao tác + timeline + trạng thái.
- Left panel: tìm sản phẩm + danh sách sản phẩm trong đơn.
- Right panel: thanh toán + lịch sử/thao tác gộp chung.

### Bước 5: Chốt hành vi cuộn

Thiết kế layout kiểu:

- Wrapper cao bằng viewport.
- Inner vùng chính dùng `overflow-hidden`.
- Mỗi panel có vùng cuộn riêng khi nội dung dài.

Lưu ý quan trọng:

- Không để toàn trang scroll dài.
- Không đặt mọi thứ vào card cao lớn rồi để trang tự trôi.

### Bước 6: Làm sạch chữ và nhãn

Tất cả text hiển thị phải:

- Có dấu đầy đủ.
- Thống nhất thuật ngữ.
- Ngắn gọn, đúng nghiệp vụ.

Ví dụ:

- `Tạo phiếu nhập`
- `Nhà cung cấp`
- `Lịch sử đơn hàng`
- `Thông tin thanh toán`
- `Nhập kho`
- `Hủy`

### Bước 7: Kiểm tra lại màn tạo phiếu

Sau khi chuyển sang layout dùng chung:

- Vẫn tạo được phiếu mới.
- Vẫn tìm và thêm sản phẩm.
- Vẫn chọn nhà cung cấp.
- Vẫn lưu nháp.
- Không bị mất dữ liệu form.
- Không bị thay đổi behavior của API create.

### Bước 8: Tự kiểm tra trước khi bàn giao

Checklist cần test:

- Màn `Tạo phiếu nhập` mở bình thường.
- Tìm sản phẩm vẫn hoạt động.
- Thêm/xóa/sửa số lượng vẫn hoạt động.
- Chọn nhà cung cấp vẫn hoạt động.
- Lưu nháp vẫn tạo được phiếu.
- Layout không bị vỡ ở màn hình nhỏ hơn.
- Danh sách dài vẫn cuộn đúng vùng.

### 6.2 Ghi nhớ thứ tự ưu tiên

- Không làm `mode edit` trước khi màn tạo đã ổn định.
- Không làm modal `Thanh toán`, `Nhập kho`, `Hoàn hàng` trước khi có shell chung.
- Không sửa encoding hàng loạt trước khi chốt xong layout, vì dễ tạo thêm nhiễu khi review.

## 7. Các chú ý quan trọng

### 7.1 Không đụng quá sâu vào backend ở phase 1

Backend hiện đã có đủ API cho phase sau. Phase 1 chỉ nên làm UI shell và giữ nguyên logic create.

### 7.2 Không tự ý đổi trạng thái nghiệp vụ

Nếu chưa xử lý xong mapping trạng thái, đừng hardcode UI theo tên backend. Hãy tạo một layer mapping riêng để sau này dễ đổi.

### 7.3 Không làm mất luồng hiện tại

Đây là điểm dễ hỏng nhất:

- Nếu refactor quá tay, có thể mất logic tìm sản phẩm, áp giá, tính tổng, chọn NCC.
- Vì vậy nên tách layout trước, giữ logic bên trong, rồi mới làm sạch dần.

### 7.4 Đừng gộp tất cả vào một file

Giao diện này khá lớn. Nếu nhét hết vào một component sẽ rất khó bảo trì. Nên tách:

- workspace shell
- header section
- left panel
- right panel
- action modal sau này

### 7.5 Đảm bảo mã nguồn UTF-8

Trong repo hiện có nhiều chuỗi tiếng Việt bị lỗi hiển thị ở một số file cũ. Khi sửa file mới, phải lưu UTF-8 chuẩn để không tạo thêm lỗi encoding.

## 8. Gợi ý phát triển sau phase 1

Sau khi xong phase 1, nên phát triển tiếp theo thứ tự này:

1. Đồng bộ màn `Chi tiết phiếu nhập` vào cùng `receipt-workspace`.
2. Tạo chế độ `view` và `edit` cho cùng một khung.
3. Thêm modal `Thanh toán` với chọn số tiền và hình thức thanh toán.
4. Thêm modal `Nhập kho` cho phép nhận một phần hoặc xác nhận đủ.
5. Thêm modal `Hoàn hàng` khi đơn đã hoàn thành.
6. Chuẩn hóa mapping trạng thái nghiệp vụ.
7. Tách phần lịch sử và thao tác ra service/hook riêng để dễ bảo trì.
8. Dọn lại naming và encoding tiếng Việt trong toàn bộ khu vực phiếu nhập.

## 9. Tiêu chí hoàn thành cho phase 1

Phase 1 chỉ được coi là xong khi:

- Có component `receipt-workspace` mới.
- Màn `Tạo phiếu nhập` đã dùng workspace đó.
- Layout đáp ứng đúng yêu cầu 3 cột.
- Có top bar theo mô tả.
- Có panel trái, panel phải, vùng nội dung chính rõ ràng.
- Trang cố định chiều cao, cuộn đúng vùng.
- Chức năng tạo phiếu hiện tại vẫn chạy bình thường.