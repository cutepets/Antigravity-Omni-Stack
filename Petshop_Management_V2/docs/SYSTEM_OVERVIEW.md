# Gioi thieu he thong Petshop Management V2

## Phien ban

- Ten he thong: Petshop Management V2
- Phien ban hien tai: 2.5.1
- Kieu trien khai: Docker Compose production
- Nhanh trien khai: codex/baseline-upgrade
- Ngay cap nhat tai lieu: 2026-05-01

## Tong quan

Petshop Management V2 la he thong quan ly van hanh cho chuoi cua hang cham soc thu cung. He thong tap trung gom cac nghiep vu ban hang, quan ly khach hang, ho so thu cung, dich vu grooming, khach san thu cung, kho hang, nhan su, cham cong, bang luong, bao cao tai chinh va cau hinh tich hop.

Nen tang duoc xay dung theo monorepo, gom ung dung API NestJS, ung dung web Next.js va cac package dung chung cho database, auth, shared DTO, UI, queue va cau hinh. Moi truong production chay bang Docker Compose voi PostgreSQL, Redis, API va Web tach container.

## Ban do he thong

```text
Petshop_Management_V2/
|-- apps/
|   |-- web/      Next.js 15 App Router, dashboard, POS va settings UI
|   `-- api/      NestJS REST API, auth, nghiep vu va tich hop
|-- packages/
|   |-- database/ Prisma schema, migrations, seed va Prisma Client
|   |-- shared/   DTO, types, constants dung chung
|   |-- auth/     JWT, RBAC va permission helpers
|   |-- api-client/ DTO/client helpers cho frontend
|   |-- queue/    BullMQ job definitions
|   |-- ui/       UI primitives dung lai
|   `-- config/   cau hinh dung chung
|-- deploy/       deploy.sh va cau hinh nginx production
`-- docs/         CODEMAPS, roadmap va tai lieu van hanh
```

Luon chinh:

1. Nguoi dung thao tac tren `apps/web`.
2. Frontend goi REST API qua `apps/web/src/lib/api`.
3. `apps/api` xu ly auth/RBAC, nghiep vu va goi Prisma.
4. `packages/database` ket noi PostgreSQL, Redis dung cho cache/queue.
5. Storage co the luu local hoac dong bo Google Drive theo cau hinh he thong.

## Cac phan he chinh

- Khach hang va CRM: quan ly ho so khach hang, nhom khach, lien he, lich su su dung dich vu va import/export Excel.
- Thu cung: quan ly ho so thu cung, thong tin suc khoe, giong loai, can nang va lien ket voi chu khach hang.
- Grooming va hotel: dieu phoi dich vu cham soc, bang gia theo loai dich vu, giong loai, can nang, ngay le va dich vu phu troi.
- Don hang va POS: tao don, cap nhat trang thai, thanh toan, hoan tra, dong bo ton kho va lich su giao dich.
- Kho hang: quan ly san pham, nha cung cap, phieu nhap, ton kho, kiem ke va dieu chinh ton.
- Nhan su: quan ly nhan vien, chi nhanh, vai tro, tai lieu nhan su, cham cong, nghi phep va bang luong.
- Bao cao: tong hop doanh thu, giao dich tai chinh, van hanh va cac chi so quan tri.
- Cau hinh he thong: quan ly tich hop Google OAuth, Google Drive, backup, bao mat va cac tham so van hanh.

## Diem cap nhat ban 2.5.1

- Map lai tai lieu he thong, CODEMAPS va thong tin gioi thieu trong Settings.
- Cap nhat luong khach hang/CRM voi ngay sinh, lich su diem va import/export Excel.
- Chuan hoa phan loai khach hang, nha cung cap va staff tren API, shared DTO va frontend.
- Cap nhat Docker production flow: commit, push branch, build image tren VPS va health check.

## Kien truc trien khai

Production deployment su dung `docker-compose.prod.yml`:

- `petshop_postgres`: PostgreSQL 16, luu tru du lieu chinh.
- `petshop_redis`: Redis 7, phuc vu queue/cache.
- `petshop_api`: NestJS API, lang nghe noi bo tren cong 3001 va expose local VPS qua `127.0.0.1:3003`.
- `petshop_web`: Next.js web app, expose local VPS qua `127.0.0.1:3002`.

Proxy cong khai duoc cau hinh ben ngoai Docker de dua domain production ve web/API. Cac bien moi truong quan trong nam trong `/root/petshop/.env` tren VPS, dac biet la `APP_SECRET_ENCRYPTION_KEY`, `DATABASE_URL`, `REDIS_URL`, `PUBLIC_API_URL`, `PUBLIC_WEB_URL`, `NEXT_PUBLIC_API_URL` va `CORS_ORIGINS`.

## Quy trinh phat hanh

Quy trinh deploy production hien tai:

1. Commit va push code len branch `codex/baseline-upgrade`.
2. SSH vao VPS theo cau hinh trong `VPS_CONFIG.md`.
3. Chay script deploy tai `/root/petshop/Petshop_Management_V2/deploy/deploy.sh`.
4. Script se pull code moi, build Docker image API/Web, recreate containers, chay Prisma migrations va health check.

## Kiem tra sau deploy

Sau moi lan deploy can xac nhan:

- API health tra ve healthy tai `http://127.0.0.1:3003/api/health` tren VPS.
- Web tra ve HTTP 200 hoac redirect hop le tai `http://127.0.0.1:3002/`.
- Cac container `petshop_api`, `petshop_web`, `petshop_postgres`, `petshop_redis` dang chay on dinh.
- Chuc nang dang nhap, khach hang, thu cung, staff va import/export Excel hoat dong voi domain production.
