# SPA & Hotel Pricing Plan

## Checklist trien khai

- [x] Chot business rules cho SPA, Hotel, weight band va holiday calendar
- [x] Step 1. Tao data foundation cho pricing
- [x] Step 1.1 Them bang weight bands
- [x] Step 1.2 Them bang hotel price rules
- [x] Step 1.3 Them bang holiday calendar dates
- [x] Step 1.4 Them field snapshot/breakdown cho hotel stay
- [x] Step 1.5 Them bang hotel stay charge lines
- [x] Step 2. Viet pricing engine cho hotel preview va checkout
- [x] Step 2.1 Auto map pet weight vao weight band bang min/max
- [x] Step 2.2 Tach hotel charge line theo REGULAR va HOLIDAY
- [x] Step 2.3 Snapshot breakdown vao hotel stay va order item lien ket
- [x] Step 3. Them SPA pricing rules + auto map can nang
- [x] Step 3.1 Them bang spa price rules
- [x] Step 3.2 Them endpoint preview gia SPA theo pet/package/weight band
- [x] Step 3.3 Snapshot gia SPA vao grooming session va order item
- [x] Step 4. Cap nhat POS va hotel UI
- [x] Step 4.1 Hien preview pricing hotel trong POS booking modal
- [x] Step 4.2 Hien active stay + preview checkout trong POS hotel checkout modal
- [x] Step 4.3 Hien breakdown charge lines trong hotel stay details
- [x] Step 4.4 Hien ho so pet + goi y dich vu trong POS
- [x] Step 4.5 Chon dich vu tu pet profile add vao cart; hotel tach thanh nhieu charge lines that
- [x] Step 5. Them bang gia truc tiep trong Hotel va Grooming
- [x] Step 5.1 Hotel > Bang gia: quan ly hang can Hotel, gia ngay thuong/ngay le, lich ngay le
- [x] Step 5.2 Grooming > Bang gia: quan ly hang can Grooming/SPA va gia theo goi
- [x] Step 6. Cap nhat reports va export

## Muc tieu

- Chuan hoa pricing cho `SPA`, `Hotel`, va mo rong sau nay cho `Thu y`.
- Tach `service catalog` khoi `pricing rules`.
- Dam bao gia duoc snapshot vao don hang, khong bi thay doi khi bang gia cap nhat.

## Rule da chot

### 1. SPA

- SPA gom cac goi:
  - Tam
  - Tam + Ve sinh
  - Cao
  - Tam + Cao + Ve sinh
  - SPA
- Gia tinh theo:
  - `species`
  - `package`
  - `weight band`
- Khong dung cong thuc `>30kg +5k/kg` nua.
- Thay vao do dung band co dinh de de van hanh:
  - `1-3kg`
  - `3-6kg`
  - `6-10kg`
  - `10-15kg`
  - `15-20kg`
  - `20-30kg`
  - `30-40kg`
  - `40-50kg`
  - `>50kg`

### 2. Weight band

- Moi band luu ro:
  - `minWeight`
  - `maxWeight`
  - `label`
  - `sortOrder`
- Quy uoc mapping:
  - `1-3kg` => `minWeight = 1`, `maxWeight = 3`
  - `3-6kg` => `minWeight = 3`, `maxWeight = 6`
- Khi chon pet, he thong lay `Pet.weight` hien tai de map vao band gia.
- Vi du:
  - pet `5kg` => tu dong roi vao band `3-6kg`
- Rule khuyen nghi cho pricing engine:
  - `weight >= minWeight`
  - `weight < maxWeight` cho cac band giua
  - band cuoi `>50kg` dung `minWeight = 50`, `maxWeight = null`
- Neu can giu label theo bang gia cu, UI chi hien label, engine van map bang `min/max`.

### 3. Hotel

- Hotel tinh theo block:
rieng ngay dau tien tinh theo:
  - `3 gio dau` => `0.5 ngay`
  - `sau 3 tieng` => `1 ngay`
nhung ngay sau tinh theo block:
  - `0-12h` => `0.5 ngay`
  - `12-24h` => `1 ngay`
- Rule nay ap dung cho tung doan ngay sau khi tach theo ngay lich.
- He thong khong tinh mot `lineType` duy nhat cho ca booking nua.
- Neu mot luot gui co ca ngay thuong va ngay le thi phai tach thanh nhieu dong.

### 4. Tach ngay thuong / ngay le

- Mot be co the phat sinh nhieu dong hoa don hotel trong cung mot stay.
- Vi du:
  - `Hotel 3-5kg 5 ngay`
  - `Hotel ngay le 3-5kg 4 ngay`
- Tong stay la `9 ngay`, nhung thanh toan tach `2 dong`.
- Tung dong luu rieng:
  - `dayType`
  - `weightBand`
  - `quantityDays`
  - `unitPrice`
  - `subtotal`

### 5. Holiday calendar

- Can co bang cai dat de danh dau ngay le theo nam.
- Moi ban ghi nen co:
  - `date`
  - `name`
  - `year`
  - `isActive`
  - `notes`
- Khong luu holiday list trong `system_configs`.
- Pricing engine hotel phai doc bang nay de xac dinh `REGULAR` hay `HOLIDAY` cho tung ngay.

## Huong thiet ke

### A. Service catalog

- Van giu `Service` de the hien danh muc ban hang.
- De xuat giu:
  - `SPA` service group
  - `HOTEL` service group
- Gia base trong `Service` chi de tham khao hoac fallback.
- Gia thuc te phai den tu pricing rules.

### B. Pricing rules

- Khong dua toan bo logic vao `ServiceVariant.name`.
- Can model pricing co cau truc.

#### SPA pricing row

- `serviceType = SPA`
- `species`
- `packageCode`
- `weightBandId`
- `basePrice`
- `durationMinutes?`
- `isActive`

#### Hotel pricing row

- `serviceType = HOTEL`
- `species`
- `dayType = REGULAR | HOLIDAY`
- `weightBandId`
- `rateHalfDay`
- `rateFullDay`
- `isActive`

## Pricing engine

### 1. Chon band can nang

- Input:
  - `species`
  - `weight`
  - `service package` hoac `hotel`
- Output:
  - `weightBand`
  - `pricingRow`

### 2. SPA calculation

- Input:
  - pet
  - package
- Output:
  - 1 dong order item SPA
  - gia duoc snapshot vao order item
  - grooming session cung luu snapshot gia

### 3. Hotel calculation

- Input:
  - pet
  - `checkIn`
  - `checkOut`
- Engine can:
  1. Tach khoang thoi gian thanh cac segment theo ngay lich
  2. Xac dinh tung segment la `REGULAR` hay `HOLIDAY`
  3. Tinh moi segment theo block:
     - `0-12h` => `0.5 ngay`
     - `12-24h` => `1 ngay`
  4. Gom cac segment cung:
     - `dayType`
     - `weightBand`
     - `unitPrice`
  5. Tra ra breakdown de len hoa don

#### Vi du output hotel

- Dong 1:
  - `Hotel thuong 3-5kg`
  - `5 ngay`
  - `unitPrice = ...`
  - `subtotal = ...`
- Dong 2:
  - `Hotel le 3-5kg`
  - `4 ngay`
  - `unitPrice = ...`
  - `subtotal = ...`

## Snapshot can luu

### Order item

- Can luu snapshot de tranh tinh lai ve sau:
  - `pricingType`
  - `weightBandLabel`
  - `weightBandMin`
  - `weightBandMax`
  - `pricingDayType?`
  - `pricingSnapshotJson`

### Grooming session

- Can luu:
  - `packageCode`
  - `weightBand`
  - `priceSnapshot`

### Hotel stay

- Can luu:
  - `weightAtBooking`
  - `weightBand`
  - `pricingSnapshot`
  - `breakdownSnapshot`

## De xuat schema

### Bang moi

- `service_weight_bands`
  - `id`
  - `serviceType`
  - `species`
  - `label`
  - `minWeight`
  - `maxWeight`
  - `sortOrder`
  - `isActive`

- `spa_price_rules`
  - `id`
  - `species`
  - `packageCode`
  - `weightBandId`
  - `price`
  - `durationMinutes`
  - `isActive`

- `hotel_price_rules`
  - `id`
  - `species`
  - `weightBandId`
  - `dayType`
  - `halfDayPrice`
  - `fullDayPrice`
  - `isActive`

- `holiday_calendar_dates`
  - `id`
  - `date`
  - `name`
  - `year`
  - `isActive`
  - `notes`

### Bang detail hoa don hotel

- `hotel_stay_charge_lines`
  - `id`
  - `hotelStayId`
  - `date`
  - `dayType`
  - `weightBandLabel`
  - `quantityDays`
  - `unitPrice`
  - `subtotal`
  - `pricingSnapshot`

> Neu chua muon them table detail ngay lap tuc, co the luu `breakdownSnapshot` JSON trong `HotelStay` va `OrderItem`, nhung huong ben vung van la table rieng.

## Thay doi API

### Hotel

- `POST /hotel/calculate`
  - tra ve:
    - `weightBand`
    - `segments`
    - `chargeLines`
    - `totalDays`
    - `totalPrice`

- `POST /hotel/stays`
  - khi tao stay phai snapshot breakdown

- `POST /hotel/:id/checkout`
  - tinh lai theo `checkOutActual`
  - cap nhat breakdown cuoi cung

### Settings

- Them CRUD cho:
  - weight bands
  - SPA price rules
  - Hotel price rules
  - holiday calendar

## Thay doi UI

### Nguyen tac dat man hinh bang gia

- Khong bat buoc tao `Settings > Bang gia dich vu` trong giai doan nay.
- Bang gia nao thuoc nghiep vu nao thi quan ly ngay trong muc do:
  - `Hotel > Bang gia`
  - `Grooming > Bang gia`
- `Settings` neu can sau nay chi dong vai tro shortcut/tong hop, khong phai duong chinh de nhan vien van hanh sua gia.
- API va component van nen dung chung de tranh duplicate logic, nhung UX phai nam tai dung module nghiep vu.

### Hotel > Bang gia

- Quan ly `service_weight_bands` voi `serviceType = HOTEL`.
- Quan ly `hotel_price_rules` theo:
  - `species`
  - `year`
  - `dayType = REGULAR | HOLIDAY`
  - `weightBandId`
  - `halfDayPrice`
  - `fullDayPrice`
- Quan ly `holiday_calendar_dates` ngay trong tab Hotel vi lich ngay le anh huong truc tiep cach tinh tien Hotel.
- Co preview tinh gia:
  - chon species + can nang + check-in/check-out
  - hien `chargeLines` tach ngay thuong/ngay le nhu POS/order se tao.

### Grooming > Bang gia

- Quan ly `service_weight_bands` voi `serviceType = GROOMING`.
- Quan ly `spa_price_rules` theo:
  - `species`
  - `packageCode`
  - `weightBandId`
  - `price`
  - `durationMinutes`
- Hien matrix:
  - Hang: hang can Grooming/SPA
  - Cot: `Tam`, `Tam + Ve sinh`, `Cao`, `Tam + Cao + Ve sinh`, `SPA`
- Can nang cua Grooming/SPA va Hotel co the khac nhau, khong dung chung band.

### POS

- Chon pet => auto load `species` + `weight`
- Auto map band can nang
- SPA:
  - chon goi
  - hien don gia theo band
- Hotel:
  - chon check-in/check-out
  - preview breakdown
  - add vao cart thanh nhieu dong neu co ca `REGULAR` va `HOLIDAY`

## Bao cao

- Reports doc tu order items va snapshot da chot.
- Hotel revenue co the tong hop theo:
  - `REGULAR`
  - `HOLIDAY`
  - `weight band`
- Khong tinh lai doanh thu dua tren bang gia hien hanh.

## Thu tu trien khai khuyen nghi

### Phase 1

- Tao `weight bands`
- Tao `holiday calendar`
- Tao `hotel pricing engine`

### Phase 2

- Tao `SPA price rules`
- Cap nhat POS de auto map can nang

### Phase 3

- Cap nhat order flow va snapshot fields
- Cap nhat hotel checkout theo breakdown

### Phase 4

- Them settings UI
- Cap nhat reports

## Files se bi anh huong khi implement

- `packages/database/prisma/schema.prisma`
- `apps/api/src/modules/hotel/hotel.service.ts`
- `apps/api/src/modules/orders/orders.service.ts`
- `apps/api/src/modules/grooming/grooming.service.ts`
- `apps/api/src/modules/settings/settings.service.ts`
- `apps/api/src/modules/reports/reports.service.ts`
- `apps/web/src/app/(dashboard)/pos/components/ServiceBookingModal.tsx`
- `apps/web/src/app/(dashboard)/hotel/*`
- `apps/web/src/app/(dashboard)/hotel/*`
- `apps/web/src/app/(dashboard)/grooming/*`
- `apps/web/src/components/service-pricing/*`

## Luu y nghiep vu can giu thong nhat

- Can nang cua pet tai luc ban la du lieu tinh gia, khong nen bi thay doi khi pet update can nang sau nay.
- Hotel invoice cho 1 be co the co nhieu dong, nhung van thuoc cung `1 stay`.
- Breakdown la phan bat buoc neu muon doi chieu gia giua POS, hotel, checkout va reports.
