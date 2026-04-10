# Payment Handoff 2026-04-10

## Muc tieu da lam

Da trien khai phase thanh toan moi theo huong:

- `/settings -> Thanh toan` quan ly payment method 1 lop
- POS chon thanh toan inline o panel phai
- Co ho tro `multi payment`
- Sau khi xac nhan multi, panel POS hien tung dong method rieng
- Moi method co mau hien thi rieng
- Co dieu kien hien thi theo chi nhanh, gio, ngay, khoang tien
- So quy va order da luu duoc `paymentAccountId` va `paymentAccountLabel`

## Da hoan tat

### 1. So quy

- Them cau hinh `Danh muc Thu/Chi`
- Them icon cau hinh ngay tren thanh ngang
- Danh muc da co backend + DB migration
- O phieu thu/chi da chon danh muc tu cau hinh thay vi text tu do

File chinh:

- `apps/web/src/app/(dashboard)/finance/_components/finance-workspace.tsx`
- `apps/web/src/app/(dashboard)/finance/_components/create-transaction-modal.tsx`
- `apps/api/src/modules/settings/settings.controller.ts`
- `apps/api/src/modules/settings/settings.service.ts`
- `packages/database/prisma/migrations/20260409152000_add_cashbook_categories/`

### 2. Thanh toan 1 lop trong settings

- Doi huong tu `Chuyen khoan` rieng le sang `/settings -> Thanh toan`
- Moi dong la 1 method hien thi truc tiep o POS/so quy:
  - `Tien mat`
  - `Techcombank`
  - `MoMo`
  - `Quet the`
- Co metadata `type` de phan loai noi bo: `CASH | BANK | EWALLET | CARD`
- Co cac rule hien thi:
  - `branchIds`
  - `minAmount`
  - `maxAmount`
  - `timeFrom`
  - `timeTo`
  - `weekdays`
- Them `colorKey` de to mau method
- Them `allowMultiPayment` trong system config
- Method `BANK` da co them cac field cau hinh QR:
  - `qrEnabled`
  - `qrProvider`
  - `qrBankBin`
  - `qrTemplate`
  - `transferNotePrefix`
- UI settings da co form cau hinh QR cho method `BANK`:
  - bat/tat QR
  - provider
  - BIN ngan hang
  - template
  - tien to noi dung chuyen khoan
- Card method trong settings da co badge `QR dong` cho bank method da bat QR

File chinh:

- `apps/web/src/app/(dashboard)/settings/components/TabPayments.tsx`
- `apps/web/src/lib/payment-methods.ts`
- `apps/web/src/lib/api/settings.api.ts`
- `apps/api/src/modules/settings/settings.controller.ts`
- `apps/api/src/modules/settings/settings.service.ts`
- `packages/database/prisma/schema.prisma`
- `packages/database/prisma/migrations/20260410103000_unify_payment_methods/`
- `packages/database/prisma/migrations/20260410143000_add_payment_method_color_and_multi_flag/`
- `packages/database/prisma/migrations/20260410170000_add_payment_qr_and_intents/`

### 3. POS single payment inline

- Bo nut `Doi TT`
- Panel phai da chuyen sang dang:
  - `Khach dua: [chip method + dropdown] [so tien]`
- Method mac dinh tu settings se duoc goi y san
- Neu method la `CASH`:
  - o tien khach dua tu goi y = tong can tra
  - co nut goi y tien nhanh
- Neu method khac `CASH`:
  - amount mac dinh = tong can thanh toan
- Dropdown method co them dong:
  - `Thanh toan nhieu hinh thuc`

File chinh:

- `apps/web/src/app/(dashboard)/pos/page.tsx`
- `apps/web/src/app/(dashboard)/pos/components/PosSettingsPanel.tsx`
- `apps/web/src/stores/pos.store.ts`

### 4. POS multi payment

- Co modal `PosPaymentModal` moi
- Ho tro chia toi da 3 method
- POS mo modal nay voi `minimumMethods = 2`
- Sau khi confirm:
  - panel POS hien tung dong method rieng
  - moi dong co mau rieng
  - hien `Tong khach dua`
  - hien trang thai `Da du` / `Con thieu`
- Khong cho duplicate method trong modal
- Cho phep luu thanh toan chua du neu khach moi ung mot phan

File chinh:

- `apps/web/src/app/(dashboard)/pos/components/PosPaymentModal.tsx`
- `apps/web/src/app/(dashboard)/pos/page.tsx`

### 5. Order / so quy / backend

- Backend order da nhan mang `payments[]`
- Moi payment luu:
  - `method`
  - `amount`
  - `paymentAccountId`
  - `paymentAccountLabel`
- `payOrder` va `completeOrder` da di theo model nhieu payment
- Co tao transaction theo tung payment method
- Trang chi tiet don hang da dung lai `PosPaymentModal` voi `minimumMethods = 1`

File chinh:

- `apps/api/src/modules/orders/dto/create-order.dto.ts`
- `apps/api/src/modules/orders/dto/pay-order.dto.ts`
- `apps/api/src/modules/orders/dto/complete-order.dto.ts`
- `apps/api/src/modules/orders/orders.service.ts`
- `apps/web/src/app/(dashboard)/orders/[id]/page.tsx`
- `apps/web/src/lib/api/order.api.ts`
- `apps/api/src/modules/reports/reports.service.ts`
- `apps/web/src/lib/api/finance.api.ts`

### 6. Filter / hien thi theo model moi

- So quy filter theo `paymentAccountId` moi
- POS settings chon `default payment` theo payment method moi
- Order settlement modal da chuyen sang model payment moi
- Da xoa / bo qua mot so file legacy thanh toan cu

File chinh:

- `apps/web/src/app/(dashboard)/finance/_components/finance-workspace.tsx`
- `apps/web/src/app/(dashboard)/orders/_components/order-settlement-modal.tsx`
- `apps/web/src/app/(dashboard)/pos/components/CheckoutModal.tsx` (legacy da bo)
- `apps/web/src/app/(dashboard)/pos/components/PosCart.tsx` (legacy da bo)
- `apps/web/src/app/(dashboard)/settings/components/TabBankTransfer.tsx` (khong con la huong chinh)

### 7. QR config + payment intent schema scaffold

- Da them enum/schema cho QR va payment intent:
  - `PaymentQrProvider`
  - `PaymentIntentStatus`
  - model `PaymentIntent`
- `PaymentIntent` da co cac truong chinh:
  - `code`
  - `orderId`
  - `branchId`
  - `paymentMethodId`
  - `amount`
  - `currency`
  - `status`
  - `provider`
  - `transferContent`
  - `qrUrl`
  - `qrPayload`
  - `metadata`
  - `expiresAt`
  - `paidAt`
- Da gan relation tu:
  - `Order`
  - `Branch`
  - `PaymentMethod`
- Backend settings da validate them cho QR:
  - khong cho `accountNumber` vuot 19 chu so khi bat QR
  - `qrBankBin` phai dung 6 chu so
  - `transferNotePrefix` duoc normalize va validate
  - khong cho trung `transferNotePrefix` giua cac payment method
- Frontend settings da validate som:
  - `accountNumber <= 19`
  - `qrBankBin` dung 6 chu so
  - `transferNotePrefix` theo pattern `^[A-Z0-9_-]{3,24}$`
- Da xac nhan scope nay moi dung o muc:
  - config QR trong settings
  - DB schema / migration cho `payment_intents`
  - chua noi vao luong tao order / POS / webhook

File chinh:

- `apps/web/src/app/(dashboard)/settings/components/TabPayments.tsx`
- `apps/web/src/lib/api/settings.api.ts`
- `apps/api/src/modules/settings/settings.service.ts`
- `packages/database/prisma/schema.prisma`
- `packages/database/prisma/migrations/20260410170000_add_payment_qr_and_intents/`

## Build / migration da chay

Da chay thanh cong:

- `pnpm --filter @petshop/database exec prisma generate --no-engine`
- `pnpm --filter @petshop/web exec tsc --noEmit`
- `pnpm --filter @petshop/api exec tsc --noEmit`

## Chua lam / de phase sau

### 1. QR dong chuyen khoan

Da lam 1 phan o muc config/schema, chua lam runtime end-to-end.

Da xong:

- Method loai `BANK` da co them config QR
- Da co field de luu provider/BIN/template/prefix
- Da co migration va schema `payment_intents`

Chua xong:

- Tao QR dong theo:
  - so tien
  - noi dung chuyen khoan duy nhat
  - method / chi nhanh
- Sinh `qrUrl` / `qrPayload` tu order hoac POS payment
- Tao / expire `payment_intent` that su khi amount thay doi

### 2. Webhook doi soat chuyen khoan

Chua lam.

Can them:

- endpoint nhan webhook
- mapping theo `noi dung CK` hoac `intent code`
- cap nhat payment status tu dong

### 3. Payment intent / auto confirm

Da lam schema scaffold, chua lam luong runtime.

Da co:

- bang `payment_intents`
- trang thai:
  - `PENDING`
  - `PAID`
  - `EXPIRED`
- lien ket voi `order / branch / paymentMethod`

Chua co:

- service tao intent
- logic sinh `transferContent`
- logic tao QR theo so tien
- webhook / auto confirm
- cap nhat order theo trang thai intent

### 4. Logic nhieu phieu thu lien ket trong so quy

Hien tai backend da luu nhieu payment cho order.

Nhung neu muon di dung theo nghiep vu:

- 2 method thanh toan -> 2 phieu thu lien ket
- can them `paymentGroupId` hoac `settlementBatchId`

Phan nay chua chot va chua lam day du.

## Luu y quan trong cho phien moi

### 1. Worktree dang co nhieu thay doi ngoai pham vi thanh toan

Repo hien tai khong sach. Co nhieu file da thay doi tu cac scope khac.

Vi vay:

- khong nen dua vao `git status` de ket luan tat ca deu thuoc feature thanh toan
- can loc dung scope file neu tiep tuc lam payment

### 2. Scope file thanh toan chinh da cham

Neu can tiep tuc o phien moi, uu tien doc cac file sau:

- `apps/web/src/app/(dashboard)/settings/components/TabPayments.tsx`
- `apps/web/src/lib/payment-methods.ts`
- `apps/web/src/lib/api/settings.api.ts`
- `apps/web/src/app/(dashboard)/pos/page.tsx`
- `apps/web/src/app/(dashboard)/pos/components/PosPaymentModal.tsx`
- `apps/web/src/app/(dashboard)/pos/components/PosSettingsPanel.tsx`
- `apps/web/src/app/(dashboard)/orders/[id]/page.tsx`
- `apps/web/src/app/(dashboard)/orders/_components/order-settlement-modal.tsx`
- `apps/api/src/modules/settings/settings.controller.ts`
- `apps/api/src/modules/settings/settings.service.ts`
- `apps/api/src/modules/orders/orders.service.ts`
- `apps/api/src/modules/reports/reports.service.ts`
- `packages/database/prisma/schema.prisma`

### 3. Migration payment da co

Da co cac migration lien quan:

- `20260409152000_add_cashbook_categories`
- `20260409183000_add_bank_transfer_accounts`
- `20260409194500_add_payment_account_to_transactions_and_order_payments`
- `20260410103000_unify_payment_methods`
- `20260410143000_add_payment_method_color_and_multi_flag`
- `20260410170000_add_payment_qr_and_intents`

### 4. Kiem tra xung dot / worktree

- Khong thay merge marker dang `<<<<<<<`, `=======`, `>>>>>>>` trong repo `Petshop_Management_V2`
- Tuy nhien worktree dang rat ban, co nhieu thay doi ngoai scope payment
- `gitnexus_detect_changes(scope: all)` ra `critical` vi toan repo dang co san nhieu file da doi, khong nen dung ket qua nay de danh gia rieng payment QR

## Buoc tiep theo de xuat

Neu mo phien moi va tiep tuc dung huong:

1. Noi runtime tao `payment_intent` tu order / POS payment
2. Chot format `transferContent` duy nhat, ngan, de doi soat
3. Sinh `qrUrl` / `qrPayload` theo so tien exact va method `BANK`
4. Them webhook doi soat
5. Map webhook -> `payment_intent` -> order / transaction
6. Neu can nghiep vu so quy chat hon, them `paymentGroupId` de nhieu phieu thu lien ket voi 1 lan thanh toan

## Ghi chu cuoi

Lan cuoi da verify:

- web typecheck pass
- api typecheck pass
- prisma generate pass
- migration `20260410170000_add_payment_qr_and_intents` da duoc tao trong repo

Neu phien moi mo len ma API dang chay tu truoc, nen restart API 1 lan de chac chan nap code / route / schema moi.
