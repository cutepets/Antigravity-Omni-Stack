"""
Manual fix script for broken Vietnamese strings (replacement char U+FFFD).
Each replacement is exact-match on the broken line content → correct line content.
"""
import os

ROOT = r'c:\Dev2\Petshop_Management_V2'

# Format: (file_rel_path, [(broken_fragment, correct_fragment), ...])
FIXES = [
    # ─── orders.service.ts ───────────────────────────────────────────────────────
    (r'apps\api\src\modules\orders\orders.service.ts', [
        ("BANK: 'Chuy\ufffd?n khoản',",               "BANK: 'Chuyển khoản',"),
        ("POINTS: 'Đi\ufffd?m tích lũy',",             "POINTS: 'Điểm tích lũy',"),
        ("if (method === 'TRANSFER') return 'Chuy\ufffd?n khoản';", "if (method === 'TRANSFER') return 'Chuyển khoản';"),
        ("'Bạn ch\ufffd? \ufffd?ược truy cập dữ li\ufffd?u thu\ufffd?c chi nhánh \ufffd?ược phân quyền'",
         "'Bạn chỉ được truy cập dữ liệu thuộc chi nhánh được phân quyền'"),
        # Stock errors
        ("chưa có t\ufffd?n kho tại",                 "chưa có tồn kho tại"),
        ("T\ufffd?n kho không \ufffd?ủ cho",           "Tồn kho không đủ cho"),
        # Session/Stay errors
        ("\ufffd?ã hoàn thành, không th\ufffd? bỏ khỏi \ufffd?ơn \ufffd?ang giao d\ufffd?ch",
         "đã hoàn thành, không thể bỏ khỏi đơn đang giao dịch"),
        ("\ufffd?ã b\ufffd? huỷ, không th\ufffd? cập nhật lại từ POS",
         "đã bị huỷ, không thể cập nhật lại từ POS"),
        ("\ufffd?ã bắt \ufffd?ầu, không th\ufffd? bỏ khỏi \ufffd?ơn \ufffd?ang giao d\ufffd?ch",
         "đã bắt đầu, không thể bỏ khỏi đơn đang giao dịch"),
        ("\ufffd?ã checkout hoặc huỷ, không th\ufffd? cập nhật lại từ POS",
         "đã checkout hoặc huỷ, không thể cập nhật lại từ POS"),
        # Order not found
        ("'Không tìm thấy \ufffd?ơn hàng'",            "'Không tìm thấy đơn hàng'"),
        # Product not exist  
        ("không t\ufffd?n tại",                         "không tồn tại"),
        # Reason/description strings
        ("`Bán hàng \ufffd?ơn ${order.orderNumber}`",   "`Bán hàng đơn ${order.orderNumber}`"),
        ("Thu từ \ufffd?ơn hàng ${order.orderNumber}", "Thu từ đơn hàng ${order.orderNumber}"),
        # Complete/cancel errors
        ("'Đơn hàng \ufffd?ã thanh toán \ufffd?ầy \ufffd?ủ'",
         "'Đơn hàng đã thanh toán đầy đủ'"),
        ("'S\ufffd? tiền thanh toán phải l\ufffd?n hơn 0'",
         "'Số tiền thanh toán phải lớn hơn 0'"),
        ("Đơn hàng \ufffd?ã hoàn thành",              "Đơn hàng đã hoàn thành"),
        ("trư\ufffd?c khi kết \ufffd?ơn",               "trước khi kết đơn"),
        ("chưa trả pet. Vui lòng checkout trư\ufffd?c khi kết \ufffd?ơn",
         "chưa trả pet. Vui lòng checkout trước khi kết đơn"),
        ("Hoàn thành \ufffd?ơn ${order.orderNumber}",  "Hoàn thành đơn ${order.orderNumber}"),
        ("Thu b\ufffd? sung \ufffd?ơn hàng ${order.orderNumber}",
         "Thu bổ sung đơn hàng ${order.orderNumber}"),
        # Remaining amount error
        ("còn thiếu ${outstandingAmount.toLocaleString('vi-VN')} \ufffd?. Vui lòng thu \ufffd?ủ trư\ufffd?c khi hoàn tất",
         "còn thiếu ${outstandingAmount.toLocaleString('vi-VN')} đ. Vui lòng thu đủ trước khi hoàn tất"),
        # Refund description
        ("Hoàn tiền dư \ufffd?ơn hàng ${order.orderNumber}",
         "Hoàn tiền dư đơn hàng ${order.orderNumber}"),
        # Overpaid
        ("'Không th\ufffd? giữ tiền dư vào công nợ khi \ufffd?ơn không có khách hàng'",
         "'Không thể giữ tiền dư vào công nợ khi đơn không có khách hàng'"),
        ("\ufffd?ang dư ${overpaidAmount.toLocaleString('vi-VN')} \ufffd?. Hãy chọn hoàn tiền hoặc giữ lại công nợ âm",
         "đang dư ${overpaidAmount.toLocaleString('vi-VN')} đ. Hãy chọn hoàn tiền hoặc giữ lại công nợ âm"),
        # Cancel
        ("'\ufffd?ã hoàn thành không th\ufffd? huỷ'",  "'đã hoàn thành không thể huỷ'"),
        ("Hoàn trả do huỷ \ufffd?ơn ${order.orderNumber}",
         "Hoàn trả do huỷ đơn ${order.orderNumber}"),
        ("'Không th\ufffd? sửa \ufffd?ơn \ufffd?ã hoàn thành'",
         "'Không thể sửa đơn đã hoàn thành'"),
        ("'Không tìm thấy item trong \ufffd?ơn'",      "'Không tìm thấy item trong đơn'"),
        # More finish order
        ("không th\ufffd? sửa \ufffd?ơn \ufffd?ã hoàn tất hoặc \ufffd?ã huỷ",
         "không thể sửa đơn đã hoàn tất hoặc đã huỷ"),
        # Item description
        ("không th\ufffd? vừa là spa vừa là hotel",   "không thể vừa là spa vừa là hotel"),
        # Dịch vụ
        ("'Đơn hàng phải có ít nhất 1 sản phẩm hoặc d\ufffd?ch vụ'",
         "'Đơn hàng phải có ít nhất 1 sản phẩm hoặc dịch vụ'"),
        # L1516 description
        ("Thu từ \ufffd?ơn hàng ${order.orderNumber} \ufffd?? ${label}",
         "Thu từ đơn hàng ${order.orderNumber} - ${label}"),
        # L2076 
        ("Thu b\ufffd? sung \ufffd?ơn hàng ${order.orderNumber} \ufffd?? ${this.getPaymentLabel(payment.method)}",
         "Thu bổ sung đơn hàng ${order.orderNumber} - ${this.getPaymentLabel(payment.method)}"),
    ]),

    # ─── settings.controller.ts ──────────────────────────────────────────────────
    (r'apps\api\src\modules\settings\settings.controller.ts', [
        ("'Không tìm thấy file t\ufffdi li?u'",     "'Không tìm thấy file tài liệu'"),
        ("'Không tìm thấy file t\ufffdili?u'",       "'Không tìm thấy file tài liệu'"),
    ]),

    # ─── UpdateStaffModal.tsx ────────────────────────────────────────────────────
    (r'apps\web\src\app\(dashboard)\staff\components\UpdateStaffModal.tsx', [
        ("'Ảnh không \ufffd?ược vượt quá 2MB'",       "'Ảnh không được vượt quá 2MB'"),
        ("'Có l\ufffd?i xảy ra khi cập nhật thông tin'",
         "'Có lỗi xảy ra khi cập nhật thông tin'"),
        ("TH\ufffd?NG TIN NH\ufffd?N VI\ufffd?N",     "THÔNG TIN NHÂN VIÊN"),
        ("Đ\ufffd?i ảnh",                              "Đổi ảnh"),
        ("Gi\ufffd?i tính",                            "Giới tính"),
        ("\ufffd?? Nữ",                                "♀ Nữ"),
        ("TH\ufffd?NG TIN LI\ufffd?N H\ufffd? & CÁ NH\ufffd?N",
         "THÔNG TIN LIÊN HỆ & CÁ NHÂN"),
        ("Đi\ufffd?n thoại",                          "Điện thoại"),
        ("Liên h\ufffd? khẩn cấp",                    "Liên hệ khẩn cấp"),
        ("<option value=\"B\ufffd?\">B\ufffd?</option>", "<option value=\"Bố\">Bố</option>"),
        ("<option value=\"Ch\ufffd?ng\">Ch\ufffd?ng</option>", "<option value=\"Chồng\">Chồng</option>"),
        ("S\ufffd? \ufffd?i\ufffd?n thoại",            "Số điện thoại"),
        ("HỢP Đ\ufffd?NG & CA L\ufffd?M VI\ufffd?C",  "HỢP ĐỒNG & CA LÀM VIỆC"),
        ("% Thư\ufffd?ng Spa",                        "% Thưởng Spa"),
        ("Giờ ngh\ufffd?",                             "Giờ nghỉ"),
        ("PH\ufffd?N QUY\ufffd?N & VAI TR\ufffd?",    "PHÂN QUYỀN & VAI TRÒ"),
        ("VAI TR\ufffd? CHÍNH",                        "VAI TRÒ CHÍNH"),
        ("VAI TR\ufffd? THEO CHI NHÁNH",              "VAI TRÒ THEO CHI NHÁNH"),
        ("Tính n\ufffd?ng chưa hoàn thi\ufffd?n",     "Tính năng chưa hoàn thiện"),
        ("Nhấn &quot;+ Thêm vai trò&quot; \ufffd?\ufffd? bắt \ufffd?ầu",
         "Nhấn &quot;+ Thêm vai trò&quot; để bắt đầu"),
        # Emoji-based ones - just remove the broken emoji placeholders
        ("\ufffd?\ufffd?\ufffd?",                      "📋"),
        ("\ufffd?\ufffd?\ufffd?\ufffd?",              "📋"),
    ]),
]


def apply_fixes(fpath: str, replacements: list) -> int:
    with open(fpath, 'r', encoding='utf-8') as f:
        content = f.read()

    changed = 0
    for broken, correct in replacements:
        if broken in content:
            content = content.replace(broken, correct)
            changed += 1

    with open(fpath, 'w', encoding='utf-8') as f:
        f.write(content)

    return changed


print("=" * 65)
print("MANUAL FIX - Broken Vietnamese Strings")
print("=" * 65)

total = 0
for rel_path, fixes in FIXES:
    fpath = os.path.join(ROOT, rel_path)
    if not os.path.exists(fpath):
        print(f"  SKIP: {rel_path}")
        continue
    n = apply_fixes(fpath, fixes)
    total += n
    print(f"  [{n} replacements] {rel_path}")

print(f"\nTotal replacements: {total}")
print("=" * 65)
