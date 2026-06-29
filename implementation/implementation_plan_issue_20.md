# Implementation Plan: Backend Master Data (Customer, Vendor, Platform) & Transactions (PR/PO)

## Deskripsi
Implementasi modul-modul backend (API endpoints & Database Schema) untuk mendukung frontend yang sudah dibuat (Issue #5). Repositori target adalah `belajar-vibe-coding` (Elysia.js + Drizzle ORM).

Modul yang akan dibangun:
1. **Customer** (`/api/customers`)
2. **Vendor** (`/api/vendors`)
3. **Platform** (`/api/platforms`)
4. **Purchase Request (PR)** (`/api/purchase-requests`)
5. **Purchase Order (PO)** (`/api/purchase-orders`)

Semua modul akan mendukung **pagination API** dan memiliki **DB Indexes**.

---

## User Review Required
> [!IMPORTANT]
> Mohon review rancangan tabel dan relasinya di bawah ini. Pastikan skema sesuai dengan kebutuhan WMS.

> [!WARNING]
> Menambahkan banyak tabel baru akan menghasilkan **migration file baru**. Pastikan untuk menjalankan `bun run db:migrate` setelah eksekusi.

---

## Proposed Changes

### 1. Modul Customer
- **Schema** `src/modules/customer/customer.schema.ts`: `id, code, name, email, type (company/personal), phone, address, province, city_regency, district, village, zip_code, image, is_active`
- **File**: `customer.validation.ts`, `customer.dto.ts`, `customer.model.ts`, `customer.controller.ts`, `customer.routes.ts`, `index.ts`

### 2. Modul Vendor
- **Schema** `src/modules/vendor/vendor.schema.ts`: `id, code, name, email, phone, address, province, city_regency, district, village, zip_code, image, is_active`
- **File**: `vendor.validation.ts`, `vendor.dto.ts`, `vendor.model.ts`, `vendor.controller.ts`, `vendor.routes.ts`, `index.ts`

### 3. Modul Platform
- **Schema** `src/modules/platform/platform.schema.ts`: `id, code, name, image, is_active`
- **File**: `platform.validation.ts`, `platform.dto.ts`, `platform.model.ts`, `platform.controller.ts`, `platform.routes.ts`, `index.ts`

### 4. Modul Purchase Request (PR)
- **Schema** `src/modules/purchase-request/purchase-request.schema.ts`:
  - `purchase_requests`: `id, code, request_date, customer_id (fk), warehouse_id (fk), description, status (0-4), requested_by (fk user), approved_by (fk user), approved_at, is_active`
  - `purchase_request_details`: `id, purchase_request_id (fk), item_id (fk), quantity, price, total_price, is_active`
- **File**: `purchase-request.validation.ts`, `purchase-request.dto.ts`, `purchase-request.model.ts`, `purchase-request.controller.ts`, `purchase-request.routes.ts`, `index.ts`
- Fitur: db.transaction untuk save header & details sekaligus, update status.

### 5. Modul Purchase Order (PO)
- **Schema** `src/modules/purchase-order/purchase-order.schema.ts`:
  - `purchase_orders`: `id, code, purchase_request_id (fk), vendor_id (fk), warehouse_id (fk), order_date, expected_delivery_date, status (0-4), total_price, tax, discount, shipping_fee, grand_total, description, is_active`
  - `purchase_order_details`: `id, purchase_order_id (fk), item_id (fk), quantity, received_quantity, price, total_price, is_active`
- **File**: `purchase-order.validation.ts`, `purchase-order.dto.ts`, `purchase-order.model.ts`, `purchase-order.controller.ts`, `purchase-order.routes.ts`, `index.ts`
- Fitur: db.transaction untuk insert, dan endpoint `/receive` untuk update `received_quantity` dan otomatisasi update status PO (Partial / Fully Received).

### 6. Seeding Menu & Permissions
- Menambahkan script seeder baru (misal: `seed-menus.ts` atau memodifikasi seeder yang sudah ada) untuk men-generate data menu baru di database (Customer, Vendor, Platform, Purchase Request, Purchase Order).
- Memberikan permission CRUD (Create, Read, Update, Delete) penuh untuk menu-menu baru tersebut **hanya kepada role Superadmin**.

### 7. App & DB Migration
- Update `src/app.ts` untuk meregistrasi ke-5 router baru.
- Jalankan `bun run db:generate` dan `bun run db:migrate`.
- Menjalankan script seeder untuk menu & permission.

---

## Verification Plan
1. `bun run db:generate` menghasilkan SQL file.
2. `bun run db:migrate` sukses mengeksekusi tabel ke DB.
3. Menjalankan test API ke endpoints (GET list pagination, CREATE single & multi-row, UPDATE status) via cURL / Postman.
