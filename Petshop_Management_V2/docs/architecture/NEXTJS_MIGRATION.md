# 🐾 Petshop Service — Tài liệu Nghiệp vụ & Domain

> **Mục đích:** Mô tả đầy đủ nghiệp vụ, API contracts, business logic, và domain types  
> để implement lại hệ thống trong cấu trúc mới (xem `NEXTJS_STRUCTURE.md` cho cấu trúc thư mục).  
> **Ngày:** 2026-04-02

---

## 1. TỔNG QUAN HỆ THỐNG

**Petshop Service Management** là hệ thống quản lý toàn diện cho cửa hàng thú cưng, gồm:

| Module | Mô tả |
|--------|-------|
| **POS** | Bán hàng đa tab, đa phương thức thanh toán |
| **CRM (Khách hàng)** | Hồ sơ, điểm tích lũy, nhóm KH |
| **Thú cưng** | Hồ sơ, sức khỏe, lịch sử dịch vụ |
| **Grooming & Spa** | Quản lý phiên chăm sóc |
| **Pet Hotel** | Đặt phòng, check-in/out, bảng giá tự động |
| **Kho hàng** | Sản phẩm, dịch vụ, nhập hàng, tồn kho |
| **Nhân sự** | Nhân viên, ca làm việc, phân quyền |
| **Tài chính** | Sổ quỹ, báo cáo doanh thu |

**Ngôn ngữ UI:** Toàn bộ tiếng Việt (labels, messages, error texts).

---

## 2. DATABASE SCHEMA

### 2.1 Danh sách Models (24 models)

| Model | Mô tả |
|-------|-------|
| `User` | Nhân viên/Admin |
| `Customer` | Khách hàng |
| `Pet` | Thú cưng |
| `PetWeightLog` | Lịch sử cân nặng |
| `PetVaccination` | Lịch sử tiêm chủng |
| `PetHealthNote` | Ghi chú sức khỏe |
| `Product` | Sản phẩm |
| `ProductVariant` | Phiên bản sản phẩm |
| `Service` | Dịch vụ |
| `ServiceVariant` | Phiên bản dịch vụ |
| `Order` | Đơn hàng |
| `OrderItem` | Chi tiết đơn hàng |
| `GroomingSession` | Phiên grooming |
| `HotelStay` | Lưu trú pet hotel |
| `HotelRateTable` | Bảng giá hotel |
| `StockReceipt` | Phiếu nhập hàng |
| `StockTransaction` | Giao dịch kho |
| `Supplier` | Nhà cung cấp |
| `Transaction` | Sổ quỹ (Thu/Chi) |
| `ShiftSession` | Ca làm việc |
| `Branch` | Chi nhánh |
| `CustomerGroup` | Nhóm khách hàng |
| `Role` | Vai trò tùy chỉnh |
| `ActivityLog` | Nhật ký thao tác |

### 2.2 Enums quan trọng

```typescript
// Đơn hàng
OrderStatus   = 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED'
PaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID' | 'COMPLETED' | 'REFUNDED'

// Nhân viên
StaffRole      = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'STAFF' | 'VIEWER'
StaffStatus    = 'PROBATION' | 'OFFICIAL' | 'LEAVE' | 'LEAVING' | 'RESIGNED' | 'QUIT' | 'WORKING'
EmploymentType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERN'

// Dịch vụ
ServiceType = 'GROOMING' | 'HOTEL' | 'MEDICAL' | 'TRAINING' | 'DAYCARE' | 'OTHER'

// Grooming
GroomingStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'

// Hotel
HotelStatus  = 'BOOKED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED'
HotelLineType = 'REGULAR' | 'HOLIDAY'

// Khách hàng
CustomerTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND'

// Sổ quỹ
TransactionType = 'INCOME' | 'EXPENSE'
```

### 2.3 Logic kho hàng (reservedStock)

```
product.stock          ← Tổng tồn kho thực tế
product.reservedStock  ← Đã đặt nhưng chưa xuất kho (đơn PENDING/PARTIAL)
availableStock         ← stock - reservedStock

Khi tạo đơn PENDING/PARTIAL: reservedStock += quantity
Khi completeOrder():         stock -= quantity, reservedStock -= quantity
Khi cancelOrder():           reservedStock -= quantity (hoàn trả)
```

### 2.4 Pet weight — Dual storage

Cân nặng thú cưng lưu ở **2 chỗ đồng thời** trong cùng 1 transaction:
1. `Pet.weight` — cân nặng hiện tại (luôn là giá trị mới nhất)
2. `PetWeightLog[]` — toàn bộ lịch sử

### 2.5 ID Format / Mã định danh

```
Customer: KH-000001   (tự tăng, 6 chữ số)
Pet:      P1B2C3      (P + 5 ký tự hex ngẫu nhiên)
Staff:    NV00001   (tự tăng, 5 chữ số)
Order:    DH260303S0001  (DHYYMMDDSXXXX, reset theo ngày)
```

---

##

## 3. API ENDPOINTS — Toàn bộ Contracts

**Base URL:** `/api`  
**Auth header:** `Authorization: Bearer <access_token>`  
**Response format:**
```json
{ "success": true, "data": { ... } }
{ "success": false, "message": "Mô tả lỗi bằng tiếng Việt" }
```
**Pagination response:**
```json
{ "data": [...], "total": 100, "page": 1, "limit": 20, "totalPages": 5 }
```

---

### 3.1 Auth

```
POST   /auth/login              { username, password } → { token, refreshToken, user }
GET    /auth/me                 → user hiện tại
POST   /auth/logout             { refreshToken }
POST   /auth/refresh            { refreshToken } → { token }
POST   /auth/change-password    { currentPassword, newPassword }
```

---

### 3.2 Customers

```
GET    /customers               ?search, page, limit, tier, groupId
POST   /customers               Tạo khách hàng mới
GET    /customers/:id           Chi tiết + pets[]
PUT    /customers/:id           Cập nhật
DELETE /customers/:id
GET    /customers/export        → Excel file
POST   /customers/import        { rows: [...] }
```

---

### 3.3 Pets

```
GET    /pets                    ?search, customerId, species
POST   /pets
GET    /pets/:id                Chi tiết đầy đủ
PUT    /pets/:id
DELETE /pets/:id

# Health sub-routes
GET    /pets/:id/weight               Lịch sử cân nặng
POST   /pets/:id/weight               { weight, date, notes } — update Pet.weight + tạo log
GET    /pets/:id/vaccinations
POST   /pets/:id/vaccinations         { vaccineName, date, nextDueDate, notes }
PUT    /pets/:id/vaccinations/:vid
DELETE /pets/:id/vaccinations/:vid
GET    /pets/:id/health-notes
POST   /pets/:id/health-notes         { content, date }
GET    /pets/:id/service-history      Grooming + hotel history
```

---

### 3.4 Inventory

```
# Sản phẩm
GET    /inventory/products            ?search, category, brand, lowStock
POST   /inventory/products
GET    /inventory/products/:id        Chi tiết + variants[]
PUT    /inventory/products/:id
DELETE /inventory/products/:id
POST   /inventory/products/:id/variants
POST   /inventory/products/:id/variants/batch   { variants: [...] }
PUT    /inventory/products/variants/:vid
DELETE /inventory/products/variants/:vid

# Dịch vụ
GET    /inventory/services            ?search, type
POST   /inventory/services
GET    /inventory/services/:id
PUT    /inventory/services/:id
DELETE /inventory/services/:id
POST   /inventory/services/:id/variants/batch
PUT    /inventory/services/variants/:vid
DELETE /inventory/services/variants/:vid
GET    /inventory/services/:id/orders  Lịch sử đơn dùng DV này
```

---

### 3.5 Orders

```
GET    /orders           ?customerId, paymentStatus (comma-sep), dateFrom, dateTo, page, limit
POST   /orders           Tạo đơn
GET    /orders/:id
PATCH  /orders/:id/pay          Thanh toán
POST   /orders/:id/complete     Hoàn thành (deduct stock)
POST   /orders/:id/cancel       Hủy (release reservedStock)
DELETE /orders/:id/items/:itemId  Xóa 1 item
```

**Body — Tạo đơn:**
```json
{
  "customerId": "...",
  "branchId": "...",
  "discount": 0,
  "shippingFee": 0,
  "notes": "...",
  "items": [
    {
      "productId": "...",
      "productVariantId": "...",
      "quantity": 2,
      "unitPrice": 50000,
      "discountItem": 0,
      "vatRate": 0
    },
    {
      "serviceId": "...",
      "type": "GROOMING",
      "petId": "...",
      "quantity": 1,
      "unitPrice": 150000
    }
  ]
}
```

**Body — Thanh toán (multi-method):**
```json
{
  "payments": [
    { "method": "CASH", "amount": 50000 },
    { "method": "MOMO", "amount": 50000 }
  ]
}
```
> Backward compat: vẫn chấp nhận `{ "paidAmount": 100000 }` nếu không có `payments[]`.

---

### 3.6 Grooming

```
GET    /grooming               ?status, staffId, dateFrom, dateTo
POST   /grooming
GET    /grooming/:id
PUT    /grooming/:id
PATCH  /grooming/:id/status    { status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' }
```

---

### 3.7 Hotel

```
GET    /hotel               ?status, petId, dateFrom, dateTo
POST   /hotel               Đặt phòng (prebook)
GET    /hotel/:id
PUT    /hotel/:id
PATCH  /hotel/:id/checkin
PATCH  /hotel/:id/checkout   { checkOut: 'ISO date string' }
PATCH  /hotel/:id/payment    { paymentStatus }
GET    /hotel/calculate      ?petId, checkIn, checkOut, lineType  → { price, nights }
DELETE /hotel/:id

# Bảng giá
GET    /hotel/rate-tables
POST   /hotel/rate-tables
GET    /hotel/rate-tables/:id
PUT    /hotel/rate-tables/:id
DELETE /hotel/rate-tables/:id
POST   /hotel/rate-tables/:id/clone   { year: 2027 }
```

> **⚠️ Route order:** `/hotel/rate-tables` và `/hotel/calculate` phải đăng ký TRƯỚC route `/:id` wildcard.

---

### 3.8 Stock (Kho hàng)

```
GET    /stock/receipts                   ?page, limit, status, supplierId
POST   /stock/receipts                   Tạo phiếu nhập
GET    /stock/receipts/:id
PUT    /stock/receipts/:id               Sửa (khi DRAFT)
PATCH  /stock/receipts/:id/pay           Thanh toán phiếu nhập
PATCH  /stock/receipts/:id/cancel        Hủy phiếu
PATCH  /stock/receipts/:id/receive       Nhận hàng (ORDERED → RECEIVED, tăng stock)
POST   /stock/receipts/:id/returns       { items: [...] } — phiếu trả hàng
GET    /stock/receipts/:id

GET    /stock/transactions/:productId    Lịch sử xuất/điều chỉnh
GET    /stock/suggestions                Gợi ý nhập hàng (SP dưới minStock)

GET    /stock/suppliers
POST   /stock/suppliers
GET    /stock/suppliers/:id
PUT    /stock/receipts/:id/supplier     Cập nhật NCC của phiếu
```

---

### 3.9 Reports & Finance

```
GET    /reports/dashboard            KPIs tổng hợp (doanh thu, đơn, KH mới)
GET    /reports/revenue-chart        ?days=7|30|90  → [{ date, revenue }]
GET    /reports/top-customers        ?limit
GET    /reports/top-products         ?limit
GET    /reports/transactions         ?page, dateFrom, dateTo, type (INCOME|EXPENSE)
POST   /reports/transactions         Tạo phiếu thu/chi
GET    /reports/transactions/:voucherNumber
```

---

### 3.10 Staff & Users

```
GET    /users                ?page, limit, search, role, branchId
POST   /users
GET    /users/:id
PUT    /users/:id
DELETE /users/:id
GET    /users/:id/stats          Thống kê (đơn, doanh thu...)
GET    /users/:id/changelog      Lịch sử thay đổi thông tin
PATCH  /users/:id/change-password  { currentPassword?, newPassword }
POST   /users/:id/documents      { type, name, url }
DELETE /users/:id/documents/:docId

# Roles
GET    /roles
POST   /roles
PUT    /roles/:id
DELETE /roles/:id

# Shifts (Ca làm việc)
GET    /shifts                    ?page, limit
GET    /shifts/current            Ca đang mở
POST   /shifts/start              { branchId, openAmount, notes }
GET    /shifts/:id/summary        Tổng kết ca
POST   /shifts/:id/end            { closeAmount, notes }
```

---

### 3.11 Settings & Misc

```
GET    /settings/configs
PUT    /settings/configs
GET    /settings/branches
POST   /settings/branches
PUT    /settings/branches/:id
DELETE /settings/branches/:id

GET    /customer-groups
POST   /customer-groups     { name, color, pricePolicy, discount, description }
GET    /customer-groups/:id
PUT    /customer-groups/:id
DELETE /customer-groups/:id

GET    /roles
POST   /roles
PUT    /roles/:id
DELETE /roles/:id

POST   /upload/image         multipart/form-data, field: "image" → { url: "/uploads/..." }

GET    /activity-logs        ?userId, action, target, dateFrom, dateTo, search
GET    /activity-logs/stats

GET    /health               → { success: true, message: '🐾 Petshop API is healthy!' }
```

---

## 4. BUSINESS LOGIC CHI TIẾT

### 4.1 completeOrder()

Thứ tự thực hiện trong 1 transaction:
1. Kiểm tra đơn tồn tại và `paymentStatus = 'PAID'`
2. Duyệt từng `OrderItem`:
   - Nếu là `product`: `stock -= quantity`, `reservedStock -= quantity`
   - Nếu có `groomingSessionId`: update GroomingSession → `COMPLETED`
   - Nếu có `hotelStayId`: update HotelStay → `CHECKED_OUT`, `paymentStatus = 'PAID'`
3. Update Order: `paymentStatus = 'COMPLETED'`
4. Tạo `ActivityLog`

### 4.2 payOrder() — Multi-payment

```typescript
// Nhận:
{ payments: [{ method: 'CASH', amount: 50000 }, { method: 'MOMO', amount: 50000 }] }
// hoặc backward compat:
{ paidAmount: 100000 }

// Logic:
totalPaid = sum of all payments.amount
if (totalPaid >= order.remainingAmount) → paymentStatus = 'PAID'
else                                    → paymentStatus = 'PARTIAL'
```

### 4.3 Multi-value filter

Filter `paymentStatus` hỗ trợ comma-separated:
```
GET /orders?paymentStatus=PENDING,PARTIAL
```
```typescript
const statusList = paymentStatus.split(',').map(s => s.trim())
where.paymentStatus = statusList.length > 1 ? { in: statusList } : statusList[0]
```

### 4.4 Hotel Price Calculation

```typescript
// GET /hotel/calculate?petId=...&checkIn=...&checkOut=...&lineType=REGULAR
// Logic:
// 1. Lấy Pet.species và Pet.weight
// 2. Query HotelRateTable match species + weight range + lineType + year
// 3. nights = diff(checkOut, checkIn) in days
// 4. price = ratePerNight * nights
```

---

## 5. POS SYSTEM — Types & Logic

### 5.1 CartItem

```typescript
interface CartItem {
  id: string
  productId?: string
  productVariantId?: string
  serviceId?: string
  serviceVariantId?: string
  description: string
  sku?: string
  barcode?: string
  quantity: number
  unitPrice: number
  discountItem: number      // Giảm giá item (VND tuyệt đối)
  vatRate: number           // VAT (%)
  petId?: string
  petName?: string
  petImage?: string
  type: 'product' | 'service'
  serviceType?: string      // 'GROOMING' | 'HOTEL' | ...
  unit: string
  baseUnitPrice?: number    // Giá gốc trước khi chọn variant
  image?: string
  variantName?: string
  groomingDetails?: {
    petId: string
    startTime?: string
    notes?: string
  }
  hotelDetails?: {
    petId: string
    checkIn: string         // ISO date string
    checkOut: string        // Dự kiến
    stayId?: string         // HotelStay.id — gán sau khi tạo
    lineType: 'REGULAR' | 'HOLIDAY'
    tableName?: string
  }
  itemNotes?: string
  isTempItem?: boolean
}
```

### 5.2 OrderTab (multi-tab POS)

```typescript
interface OrderTab {
  id: string
  title: string             // "Đơn 1", "Đơn 2"...
  customerId?: string
  customerName: string
  productSearch: string
  cart: CartItem[]
  payments: PaymentEntry[]  // [{ method: 'CASH', amount: 100000 }]
  discountTotal: number     // Giảm giá tổng đơn (VND)
  shippingFee: number
  notes: string
  activePetIds: string[]    // Pets đang active trong tab
  existingOrderId?: string      // Nếu đang load đơn cũ (PENDING/PARTIAL)
  existingOrderNumber?: string
  existingPaymentStatus?: string
  existingAmountPaid?: number
  branchId?: string
}

interface PaymentEntry {
  method: string  // 'CASH' | 'BANK' | 'MOMO' | 'VNPAY' | 'CARD' | 'POINTS'
  amount: number
}
```

### 5.3 usePOSOrder Hook — Public API

```typescript
// State manager trung tâm cho POS
return {
  // Tab management
  tabs: OrderTab[]
  activeTabId: string
  activeTab: OrderTab
  addTab: () => void
  closeTab: (tabId: string) => void
  setActiveTabId: (id: string) => void

  // Cart operations
  addToCart: (item: CartItem) => void
  removeFromCart: (itemId: string) => void
  updateQty: (itemId: string, qty: number) => void
  updatePrice: (itemId: string, price: number) => void
  updateItemDiscount: (itemId: string, discount: number) => void
  updateItemNotes: (itemId: string, notes: string) => void

  // Order operations
  loadExistingOrder: (order: ApiOrder) => Promise<void>
  // ⚠️ PHẢI dùng hàm này để load đơn cũ,
  //    KHÔNG set cart thủ công — sẽ gây CartItem format sai

  submitOrder: () => Promise<void>        // Tạo đơn mới
  payExistingOrder: () => Promise<void>   // Thanh toán đơn cũ
  completeOrderMutation: UseMutationResult
  removeItemMutation: UseMutationResult

  // Computed
  cartSubtotal: number    // Tổng trước giảm giá
  cartDiscount: number    // Tổng giảm giá
  cartTotal: number       // Tổng sau giảm giá
}
```

### 5.4 Payment Methods

```typescript
const PAYMENT_METHODS = [
  { key: 'CASH',   label: 'Tiền mặt',     icon: Banknote },
  { key: 'BANK',   label: 'Chuyển khoản', icon: Building2 },
  { key: 'MOMO',   label: 'MoMo',         icon: Smartphone },
  { key: 'VNPAY',  label: 'VNPay',        icon: CreditCard },
  { key: 'CARD',   label: 'Thẻ',          icon: CreditCard },
  { key: 'POINTS', label: 'Điểm',         icon: Star },
]
```

### 5.5 Panel "Đơn đang xử lý"

Khi chọn khách hàng trong POS, tự động query để hiện đơn PENDING/PARTIAL:
```typescript
useQuery({
  queryKey: ['pending-orders', customerId],
  queryFn: () => orderApi.list({
    customerId,
    paymentStatus: 'PENDING,PARTIAL',
    limit: 20,
  }),
  enabled: !!customerId,
})
```

### 5.6 Print Receipt

```
Flow:
1. completeOrder() thành công
2. setPrintData({ order, items })
3. <PrintReceipt> renders (hidden div)
4. window.print() tự động gọi
5. @media print: ẩn toàn bộ UI, chỉ hiện receipt
6. onAfterPrint: cleanup printData

Kích thước: 80mm width, font monospace
Nội dung: orderCode, tên KH, items, tổng, thanh toán, ngày giờ, nhân viên
```

---

## 6. AUTHENTICATION

### 6.1 Flow

```
1. POST /auth/login → { accessToken (15m), refreshToken (7d), user }
2. Lưu accessToken: memory hoặc cookie httpOnly
3. Mỗi request: Authorization: Bearer <accessToken>
4. Access token hết hạn (401) → POST /auth/refresh → token mới
5. Refresh token hết hạn → redirect /login
```

### 6.2 JWT Payload

```typescript
interface JwtPayload {
  userId: string
  role: StaffRole   // 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'STAFF' | 'VIEWER'
  iat: number
  exp: number
}
```

### 6.3 RBAC — Phân quyền mặc định

| Role | Quyền |
|------|-------|
| `SUPER_ADMIN` | Toàn bộ quyền (kể cả system config, xóa dữ liệu) |
| `ADMIN` | Toàn bộ trừ system config |
| `MANAGER` | Orders, customers, pets, inventory, reports |
| `STAFF` | Orders, customers (read), pets, grooming |
| `VIEWER` | Read-only toàn bộ |

Ngoài roles hệ thống, có **Custom Roles** lưu trong bảng `roles` với `permissions` dạng JSON array.  
Ví dụ: `["order:create", "order:pay", "customer:read"]`

---

## 7. SEARCH PATTERN — Diacritic-insensitive Vietnamese

Tất cả search box phải hỗ trợ không phân biệt dấu và hoa/thường:

```typescript
// Normalize function (dùng chung ở cả FE + BE)
const normalize = (str: string) =>
  str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

// Multi-term AND logic:
// Tìm "tha pho" → match "Thành phố" ✅, "Thanh Long" ❌ (thiếu "pho")
const match = (query: string, target: string) => {
  const terms = query.split(' ').filter(Boolean)
  return terms.every(term => normalize(target).includes(normalize(term)))
}
```

**Áp dụng cho:** Tìm sản phẩm POS, tìm khách hàng POS, search inventory, search customers.

---

## 8. FILE UPLOAD

```
POST /upload/image
Content-Type: multipart/form-data
Field name: "image"
Max size: 50MB

Response: { url: "/uploads/images/<filename>.jpg" }
```
File serve tại route `/uploads` (static files).

---

## 9. REAL-TIME (Socket.io)

```typescript
// Events được emit từ server:
'grooming:updated'   // { sessionId, status }  — cập nhật board grooming
'hotel:updated'      // { stayId, status }
'stock:alert'        // { productId, stock }    — cảnh báo tồn kho thấp

// Client subscribe:
socket.on('grooming:updated', (data) => refetch())
```

---

## 10. BACKGROUND JOBS (BullMQ)

| Queue | Job | Trigger | Payload |
|-------|-----|---------|---------|
| `notification` | `grooming-complete` | Grooming COMPLETED | `{ sessionId, customerId, petName }` |
| `notification` | `hotel-checkin-reminder` | 1 ngày trước check-in | `{ stayId, petId }` |
| `notification` | `low-stock-alert` | Hàng đêm 0h | `{ productId, stock, minStock }` |
| `report` | `daily-revenue` | Cuối ngày | `{ date }` |
| `report` | `export-excel` | User trigger | `{ type, filters }` |
| `misa-sync` | `sync-invoice` | completeOrder | `{ orderId }` (tương lai) |

---

## 11. CODING CONVENTIONS

### API Response
```typescript
// Success
{ success: true, data: T }
{ success: true, data: T[], total: number, page: number, limit: number, totalPages: number }

// Error
{ success: false, message: 'Mô tả lỗi tiếng Việt' }
```

### Vietnamese Messages
Tất cả error messages và UI labels phải bằng **tiếng Việt**. Ví dụ:
```
'Không tìm thấy đơn hàng'
'Bạn không có quyền thực hiện hành động này'
'Token không hợp lệ hoặc đã hết hạn'
'Quá nhiều request, vui lòng thử lại sau'
```

### Date/Time
- Lưu DB: UTC ISO string
- Hiển thị: `dd/MM/yyyy HH:mm` (timezone +07:00 Việt Nam)

---

## 12. TÍNH NĂNG ĐÃ HOÀN THÀNH (Checklist rebuild)

### POS
- [x] Multi-tab order management
- [x] Tìm kiếm AND-logic, diacritic-insensitive
- [x] Thêm grooming service vào cart (kèm pet selection)
- [x] Thêm hotel service vào cart (date picker + tính giá tự động)
- [x] Thanh toán đa phương thức (CASH, BANK, MOMO, VNPAY, CARD, POINTS)
- [x] Panel "Đơn đang xử lý" (PENDING/PARTIAL của KH)
- [x] Load lại đơn cũ → tiếp tục xử lý
- [x] Smart item removal (confirm chỉ khi đơn cũ)
- [x] completeOrder → in hóa đơn 80mm

### Khách hàng
- [x] CRUD + mã KH tự động (KH-000001)
- [x] Nhóm khách hàng + tier (BRONZE→DIAMOND)
- [x] Điểm tích lũy
- [x] Import/Export Excel
- [x] Hồ sơ: pets, lịch sử đơn

### Thú cưng
- [x] CRUD + mã ngẫu nhiên (P1B2C3)
- [x] Lịch sử cân nặng (chart)
- [x] Lịch sử tiêm chủng
- [x] Ghi chú sức khỏe
- [x] Lịch sử dịch vụ

### Kho hàng
- [x] CRUD sản phẩm + variants (size, màu, đơn vị)
- [x] CRUD dịch vụ + variants
- [x] Nhập hàng + nhà cung cấp
- [x] reservedStock / availableStock logic
- [x] Cảnh báo tồn kho thấp
- [x] Lịch sử giao dịch kho

### Grooming & Hotel
- [x] State machine grooming: PENDING → IN_PROGRESS → COMPLETED
- [x] Giao nhân viên thực hiện
- [x] Check-in/check-out hotel
- [x] Bảng giá: species + weight range + REGULAR/HOLIDAY
- [x] Clone bảng giá sang năm mới

### Nhân sự
- [x] CRUD + staffCode (NV-000001)
- [x] System roles (SUPER_ADMIN → VIEWER)
- [x] Custom roles + permissions JSON
- [x] Ca làm việc (open/close shift)
- [x] Hồ sơ: lương, hợp đồng, tài liệu đính kèm

### Tài chính & Báo cáo
- [x] Sổ quỹ Thu/Chi (liên kết đơn hàng)
- [x] Dashboard KPI
- [x] Biểu đồ doanh thu theo ngày (recharts)
- [x] Top khách hàng, top sản phẩm

### Hệ thống
- [x] JWT Auth (access 15m + refresh 7d)
- [x] Role-based authorization
- [x] Rate limiting
- [x] Swagger API docs
- [x] Activity logs
- [x] Dark/light mode
- [x] Settings (chi nhánh, system config)
- [x] Socket.io (grooming realtime)
- [x] BullMQ background jobs

---

## 13. LESSONS LEARNED — Lỗi đã gặp, không lặp lại

| ID | Lỗi | Root Cause | Rule |
|----|-----|------------|------|
| L001 | DB deadlock | Multiple DB client instances | Chỉ 1 PrismaClient singleton trong toàn app |
| L002 | CartItem format sai | Manual mapping từ API data thô | Luôn dùng `loadExistingOrder()`, không set cart thủ công |
| L003 | Multi-value filter sai | ORM không nhận string `"PENDING,PARTIAL"` | Parse thành array trước khi query |
| L004 | Route conflict | Wildcard `/:id` bắt trước routes cụ thể | Đăng ký routes cụ thể TRƯỚC wildcard |
