# Staff Module - Backend API Documentation

## Overview
Module quản lý nhân viên với đầy đủ tính năng: CRUD, Documents, Attendance, Salary, Performance.

---

## Base URL
```
/api/staff
```

---

## Authentication
Tất cả endpoints yêu cầu:
- **JWT Token** trong header: `Authorization: Bearer <token>`
- **Permissions** tương ứng

---

## 1. Staff CRUD Operations

### 1.1 Get All Staff
```http
GET /api/staff
```
**Permission:** `staff.read`

**Response:**
```json
[
  {
    "id": "cmnmy06jk000bk5744y12yo94",
    "staffCode": "NV00001",
    "username": "hotel02",
    "fullName": "Dieu Phoi Hotel 2",
    "role": { "id": "...", "name": "Bán Hàng", ... },
    "status": "WORKING",
    "phone": null,
    "email": null,
    "branch": { "id": "...", "name": "..." },
    "avatar": null,
    "createdAt": "2026-01-15T...",
    "employmentType": "FULL_TIME",
    "shiftStart": "08:00",
    "shiftEnd": "17:00",
    "baseSalary": 8000000,
    "spaCommissionRate": 10
  }
]
```

---

### 1.2 Get Staff by ID
```http
GET /api/staff/:id
```
**Permission:** `staff.read`

**Response:** Same as above + `authorizedBranches`, `joinDate`, `dob`, `identityCode`, etc.

---

### 1.3 Create Staff
```http
POST /api/staff
```
**Permission:** `staff.create`

**Body:**
```json
{
  "username": "nv001",
  "password": "Petshop@123",  // optional, default: Petshop@123
  "fullName": "Nguyễn Văn A",
  "role": "role-id",
  "phone": "0912345678",
  "email": "nva@petshop.vn",
  "branchId": "branch-id",
  "authorizedBranchIds": ["branch1", "branch2"],
  "gender": "Nam",
  "dob": "1990-01-01",
  "identityCode": "123456789012",
  "emergencyContactTitle": "Vợ",
  "emergencyContactPhone": "0987654321",
  "shiftStart": "08:00",
  "shiftEnd": "17:00",
  "baseSalary": 8000000,
  "spaCommissionRate": 10,
  "employmentType": "FULL_TIME",
  "joinDate": "2026-01-01"
}
```

---

### 1.4 Update Staff
```http
PATCH /api/staff/:id
```
**Permission:** `staff.update`

**Body:** (Same fields as Create, all optional)

---

### 1.5 Deactivate Staff
```http
DELETE /api/staff/:id
```
**Permission:** `staff.deactivate`

**Action:** Sets status to `RESIGNED`

---

## 2. Document Management

### 2.1 Get Documents
```http
GET /api/staff/:id/documents
```
**Permission:** `staff.read`

**Response:**
```json
[
  {
    "id": "doc-id",
    "userId": "user-id",
    "type": "CCCD_FRONT",
    "fileName": "cccd_front.jpg",
    "fileUrl": "/uploads/documents/user-id/cccd_front.jpg",
    "fileSize": 1024000,
    "mimeType": "image/jpeg",
    "description": null,
    "uploadedAt": "2026-04-13T...",
    "uploadedBy": "admin-id",
    "expiresAt": null,
    "isActive": true
  }
]
```

**Document Types:**
- `CCCD_FRONT` - CCCD mặt trước
- `CCCD_BACK` - CCCD mặt sau
- `APPLICATION` - Hồ sơ xin việc
- `CERTIFICATE` - Bằng cấp / Chứng chỉ
- `CONTRACT` - Hợp đồng lao động
- `HEALTH_CERT` - Giấy khám sức khỏe
- `TRAINING_CERT` - Chứng chỉ đào tạo
- `OTHER` - Tài liệu khác

---

### 2.2 Upload Document
```http
POST /api/staff/:id/documents/upload
Content-Type: multipart/form-data
```
**Permission:** `staff.update`

**Form Data:**
```
file: <binary>
type: CCCD_FRONT
description: (optional)
expiresAt: 2027-01-01T00:00:00.000Z (optional)
currentUser: admin-username (optional, default: system)
```

**Validation:**
- Max file size: 10MB
- Allowed types: image/jpeg, image/png, image/webp, application/pdf, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document

**Response:**
```json
{
  "id": "doc-id",
  "userId": "user-id",
  "type": "CCCD_FRONT",
  "fileName": "original_name.jpg",
  "fileUrl": "/uploads/documents/user-id/timestamp-original_name.jpg",
  "fileSize": 1024000,
  "mimeType": "image/jpeg",
  "description": null,
  "uploadedAt": "2026-04-13T...",
  "uploadedBy": "admin-id",
  "expiresAt": null,
  "isActive": true
}
```

---

### 2.3 Delete Document
```http
DELETE /api/staff/:id/documents/:docId
```
**Permission:** `staff.update`

**Action:** Soft delete (sets `isActive = false`)

---

## 3. Performance Metrics

### 3.1 Get Performance
```http
GET /api/staff/:id/performance?month=4&year=2026
```
**Permission:** `staff.read`

**Query Parameters:**
- `month` (optional): 1-12, default: current month
- `year` (optional): YYYY, default: current year

**Response:**
```json
{
  "monthlyRevenue": 50000000,
  "monthlySpaSessions": 25,
  "monthlyOrders": 150,
  "month": 4,
  "year": 2026
}
```

**Data Sources:**
- `monthlyRevenue`: Sum of `Order.total` where `status = COMPLETED`
- `monthlyOrders`: Count of completed orders
- `monthlySpaSessions`: Count of `GroomingSession` where `status = COMPLETED`

---

## 4. Branch Roles

### 4.1 Get Branch Roles
```http
GET /api/staff/:id/branch-roles
```
**Permission:** `staff.read`

**Response:**
```json
[
  {
    "role": "Bán Hàng",
    "branch": "Tô Hiệu"
  },
  {
    "role": "Check đơn",
    "branch": "Nguyễn Khang"
  }
]
```

**Note:** Currently returns placeholder data based on user's primary branch and role.

---

## 5. Attendance / Timekeeping

### 5.1 Get Attendance
```http
GET /api/staff/:id/attendance?month=4&year=2026
```
**Permission:** `staff.read`

**Query Parameters:**
- `month` (optional): 1-12
- `year` (optional): YYYY

**Response:**
```json
{
  "month": 4,
  "year": 2026,
  "totalShifts": 22,
  "completedShifts": 20,
  "openShifts": 2,
  "totalHours": 176.5,
  "workingDays": 22,
  "totalRevenue": 85000000,
  "dailyHours": {
    "2026-04-01": 8.5,
    "2026-04-02": 9.0,
    ...
  },
  "shifts": [
    {
      "id": "shift-id",
      "openedAt": "2026-04-01T08:00:00.000Z",
      "closedAt": "2026-04-01T17:30:00.000Z",
      "status": "CLOSED",
      "branchId": "branch-id",
      "orderCount": 15,
      "collectedAmount": 5000000,
      "differenceAmount": 0,
      "reviewStatus": "APPROVED"
    }
  ]
}
```

**Data Source:** `ShiftSession` model
- Filters by `staffId` and `openedAt` in month
- Calculates hours from `openedAt` to `closedAt`
- Aggregates `collectedAmount` for revenue

---

## 6. Salary Calculation

### 6.1 Get Salary
```http
GET /api/staff/:id/salary?month=4&year=2026
```
**Permission:** `staff.read`

**Query Parameters:**
- `month` (optional): 1-12
- `year` (optional): YYYY

**Response:**
```json
{
  "month": 4,
  "year": 2026,
  "baseSalary": 8000000,
  "proRatedBaseSalary": 7384615,
  "actualWorkingDays": 22,
  "expectedWorkingDays": 26,
  "commission": {
    "rate": 10,
    "groomingRevenue": 15000000,
    "amount": 1500000,
    "sessionCount": 25
  },
  "bonuses": {
    "fullAttendance": 0,
    "revenue": 1000000,
    "total": 1000000
  },
  "deductions": {
    "shortages": 50000,
    "total": 50000
  },
  "netSalary": 9834615,
  "attendance": {
    "totalShifts": 22,
    "completedShifts": 20,
    "workingDays": 22,
    "totalHours": 176.5
  }
}
```

**Salary Calculation Formula:**
```
Net Salary = (Base Salary / 26 * Actual Working Days) 
           + (Grooming Revenue * Commission Rate / 100)
           + Full Attendance Bonus (500K if 100% shifts completed)
           + Revenue Bonus (1M if revenue > 50M)
           - Shortages (sum of negative differenceAmount)
```

**Data Sources:**
- `baseSalary`, `spaCommissionRate`: From `User` model
- `workingDays`, `totalHours`: From `ShiftSession` aggregation
- `groomingRevenue`: Sum of `GroomingSession.price` where `status = COMPLETED`
- `shortages`: Sum of `abs(differenceAmount)` where `differenceAmount < 0`

---

## Error Responses

### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "Không tìm thấy nhân viên"
}
```

### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": "File size must be less than 10MB"
}
```

### 403 Forbidden
```json
{
  "statusCode": 403,
  "message": "Forbidden resource"
}
```

### 409 Conflict
```json
{
  "statusCode": 409,
  "message": "Username hoặc số điện thoại đã tồn tại"
}
```

---

## Database Models

### User
- `id`, `staffCode`, `username`, `fullName`, `passwordHash`
- `baseSalary`, `spaCommissionRate`, `employmentType`
- `shiftStart`, `shiftEnd`, `joinDate`, `branchId`
- `phone`, `email`, `avatar`, `gender`, `dob`, `identityCode`
- `status` (WORKING, PROBATION, LEAVE, RESIGNED, etc.)
- Relations: `branch`, `role`, `authorizedBranches`, `documents`

### EmployeeDocument
- `id`, `userId`, `type` (enum), `fileName`, `fileUrl`
- `fileSize`, `mimeType`, `description`, `uploadedAt`
- `uploadedBy`, `expiresAt`, `isActive`
- Relation: `user`

### ShiftSession
- `id`, `staffId`, `branchId`, `openedAt`, `closedAt`
- `collectedAmount`, `orderCount`, `differenceAmount`
- `status` (OPEN, CLOSED), `reviewStatus`
- Relation: `staff`, `branch`

### GroomingSession
- `id`, `staffId`, `status`, `startTime`, `endTime`
- `price`, `petId`, `serviceId`
- Relation: `staff`, `pet`

### Order
- `id`, `staffId`, `status`, `total`, `createdAt`
- Relation: `staff`

---

## Permissions

| Permission | Description | Used By |
|------------|-------------|---------|
| `staff.read` | View staff info | GET all endpoints |
| `staff.create` | Create new staff | POST /staff |
| `staff.update` | Update staff info | PATCH /staff, Document upload/delete |
| `staff.deactivate` | Deactivate staff | DELETE /staff |
| `role.read` | View roles | (Optional, for role dropdowns) |

---

## File Storage

### Current Implementation
- Files stored at: `/uploads/documents/{userId}/{timestamp}-{filename}`
- File URL format: `/uploads/documents/{userId}/{filename}`

### TODO for Production
1. Integrate cloud storage (AWS S3, Cloudinary, GCS)
2. Create file serving endpoint: `GET /uploads/documents/:userId/:filename`
3. Add file compression for images
4. Implement file virus scanning
5. Add file access control (only owner/admin can download)

---

## Rate Limiting
- Global: 100 requests / 60 seconds per IP
- Configured in `app.module.ts` via `ThrottlerModule`

---

## Swagger Documentation
Available at: `http://localhost:3000/api/docs`
- All endpoints documented with request/response examples
- Try it out feature enabled for testing

---

## Testing Checklist

- [ ] GET /api/staff - List all staff
- [ ] GET /api/staff/:id - Get staff detail
- [ ] POST /api/staff - Create new staff
- [ ] PATCH /api/staff/:id - Update staff
- [ ] DELETE /api/staff/:id - Deactivate staff
- [ ] GET /api/staff/:id/documents - List documents
- [ ] POST /api/staff/:id/documents/upload - Upload document
- [ ] DELETE /api/staff/:id/documents/:docId - Delete document
- [ ] GET /api/staff/:id/performance - Get performance metrics
- [ ] GET /api/staff/:id/branch-roles - Get branch roles
- [ ] GET /api/staff/:id/attendance - Get attendance data
- [ ] GET /api/staff/:id/salary - Get salary breakdown

---

## Notes

1. **Route Order is Critical**: Specific routes (`:id/documents`) must be declared BEFORE generic routes (`:id`) in NestJS controllers.

2. **Soft Deletes**: EmployeeDocument uses soft delete (`isActive = false`) instead of hard delete.

3. **Salary Calculation**: Based on actual working days, not calendar days. Standard month = 26 working days.

4. **Performance Metrics**: Only counts COMPLETED orders and grooming sessions.

5. **File Validation**: Only images and PDFs allowed, max 10MB.

---

**Last Updated:** 2026-04-13
**Version:** 1.0.0
