# Task: Thu gọn timeline ở chi tiết đơn nhập

## Mục tiêu
Sửa lại timeline ở màn chi tiết đơn nhập để:
- nhỏ gọn hơn
- không dùng nền/card lớn
- không bị lệch kẻ ngang
- đặt gọn ở góc trên bên phải của phần đơn

## Phạm vi
- File chính cần chỉnh: `Petshop_Management_V2/apps/web/src/app/(dashboard)/inventory/receipts/[id]/_components/receipt-detail.tsx`

## Yêu cầu UI
- Timeline chỉ hiển thị dạng dòng nhỏ, gọn.
- Các bước cần có:
  - Đặt hàng
  - Thanh toán
  - Nhập kho
  - Hoàn thành
- Mỗi bước cần thể hiện trạng thái đã xong/chưa xong và thời điểm hoàn thành nếu có.
- Bước `Hoàn thành` chỉ sáng khi tất cả bước trước đó đã xong.
- Bỏ nền/khung to, ưu tiên layout nhẹ và cân hàng ngang.

## Tiêu chí hoàn thành
- Timeline nhìn gọn, không chiếm diện tích lớn.
- Không còn cảm giác lệch line ngang.
- Nằm đúng ở khu vực trên bên phải của phần chi tiết đơn.
- Giữ đúng logic trạng thái của đơn.
