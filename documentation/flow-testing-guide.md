# 🧪 Panduan Flow Testing — WMS API

Dokumen ini menjelaskan cara menjalankan dan memahami seluruh flow testing
yang tersedia untuk memvalidasi fungsionalitas API WMS (Warehouse Management System).

---

## 📋 Prasyarat

Sebelum menjalankan test, pastikan semua kondisi berikut sudah terpenuhi:

### 1. Dependensi Terinstal

```bash
bun install
```

### 2. Database Sudah Siap

```bash
# Jalankan migration untuk membuat/update struktur tabel
bun run db:migrate

# Jalankan seeding untuk data awal (roles, menus, permissions, superadmin)
bun run db:seed
```

### 3. Server Berjalan

Buka terminal **terpisah** dan jalankan server:

```bash
bun run dev
```

Pastikan server berjalan di `http://localhost:3000`. Verifikasi dengan:

```bash
# Cek endpoint health
curl http://localhost:3000/health
```

Response yang diharapkan:
```json
{
  "status": "ok",
  "timestamp": "2026-06-18T07:00:00.000Z",
  "version": "1.0.0"
}
```

### 4. Akun Superadmin Tersedia

Flow testing menggunakan akun superadmin default yang dibuat saat seeding:

| Field    | Value              |
|----------|--------------------|
| Email    | `adminit@gmail.com` |
| Password | `12345678`          |

> **⚠ Penting:** Jika password superadmin telah diubah, update nilai tersebut
> di setiap file test pada baris `password: "12345678"`.

---

## 📁 Struktur File Testing

```
src/flow-testing-feature/
│
├── test-flow.ts                 # Auth Module (Login, Logout, OAuth)
├── test-flow-warehouse.ts       # Warehouse Module
├── test-flow-category.ts        # Category Module
├── test-flow-uom.ts             # UOM Module
├── test-flow-item.ts            # Item Module (Single & Package)
└── test-flow-master-data.ts     # Master Runner (semua modul sekaligus)
```

---

## 🚀 Cara Menjalankan Test

> **Semua perintah dijalankan dari root direktori proyek.**
> Pastikan server sudah berjalan sebelum menjalankan test apapun.

### Opsi A — Jalankan Semua Sekaligus (Recommended)

```bash
bun run test:flow:master-data
```

Script ini menjalankan semua modul master data (Warehouse, Category, UOM, Item)
secara berurutan dan menampilkan laporan hasil di akhir.

---

### Opsi B — Jalankan Per Modul

#### Authentication (Login, Logout, OAuth)

```bash
bun run test:flow:auth
```

#### Warehouse

```bash
bun run test:flow:warehouse
```

#### Category Item

```bash
bun run test:flow:category
```

#### UOM (Unit of Measurement)

```bash
bun run test:flow:uom
```

#### Item (Single & Package)

```bash
bun run test:flow:item
```

---

### Opsi C — Jalankan Langsung dengan Bun

Jika ingin menjalankan tanpa script alias:

```bash
bun run src/flow-testing-feature/test-flow-warehouse.ts
bun run src/flow-testing-feature/test-flow-category.ts
bun run src/flow-testing-feature/test-flow-uom.ts
bun run src/flow-testing-feature/test-flow-item.ts
bun run src/flow-testing-feature/test-flow-master-data.ts
```

---

## 📖 Penjelasan Setiap Modul Test

---

### 🔐 Authentication Test

**File:** `src/flow-testing-feature/test-flow.ts`
**Command:** `bun run test:flow:auth`

**Skenario yang diuji:**

| No | Skenario | Expected |
|----|----------|----------|
| 1 | Login dengan email & password valid | Status 200, dapat `accessToken` |
| 2 | Logout dengan token valid | Status 200, sesi direvoke |
| 3 | Akses endpoint dengan token yang sudah di-revoke | Status 401 |
| 4 | OAuth redirect (Google) | Status 302, ada header `Location` |
| 5 | OAuth callback (Google mock) | Status 200 atau error mock |
| 6 | OAuth callback (GitHub mock) | Status 200 atau error mock |

**Mekanisme:** Test ini membuat user baru, melakukan login, lalu menguji sesi dan OAuth flow.
Semua data test dibersihkan (hard delete) di akhir.

---

### 🏭 Warehouse Test

**File:** `src/flow-testing-feature/test-flow-warehouse.ts`
**Command:** `bun run test:flow:warehouse`

**Skenario yang diuji:**

| No | Skenario | Expected |
|----|----------|----------|
| 1 | Login superadmin | Status 200, dapat token |
| 2 | GET list warehouse (sebelum create) | Status 200, pagination valid |
| 3 | CREATE warehouse baru dengan koordinat & kode wilayah | Status 200, data tersimpan |
| 4 | CREATE warehouse dengan code yang sama (duplikat) | Status 400, pesan error |
| 5 | GET detail warehouse by ID | Status 200, koordinat & kode wilayah benar |
| 6 | GET list warehouse dengan pagination `?limit=5` | Status 200, meta pagination ada |
| 7 | SEARCH warehouse `?searchTerm=Jakarta&filterColumn=name` | Status 200, data ditemukan |
| 8 | UPDATE warehouse (nama & zip code) | Status 200, data terupdate |
| 9 | ASSIGN kepala gudang (warehouse head) | Status 200, record head dibuat |
| 10 | GET daftar kepala gudang by warehouse ID | Status 200, daftar tampil |
| 11 | UNASSIGN kepala gudang (soft delete head) | Status 200 |
| 12 | SOFT DELETE warehouse | Status 200 |
| 13 | Verifikasi soft-delete — GET by ID yang sudah didelete | Status 400 |
| 14 | Verifikasi di DB bahwa `deleted_at` terisi | Field `deletedAt` ada timestamp |

**Catatan Khusus:**
- Kode wilayah administratif (province, city_regency, district, village) disimpan sebagai
  `VARCHAR` sesuai standar BPS/Kemendagri, bukan nama string. Contoh: `"31"` untuk DKI Jakarta.
- Warehouse heads adalah tabel pivot yang menghubungkan user (kepala gudang) ke warehouse.

---

### 📂 Category Test

**File:** `src/flow-testing-feature/test-flow-category.ts`
**Command:** `bun run test:flow:category`

**Skenario yang diuji:**

| No | Skenario | Expected |
|----|----------|----------|
| 1 | Login superadmin | Status 200 |
| 2 | GET list category (sebelum create) | Status 200, pagination valid |
| 3 | CREATE category baru | Status 200, code otomatis UPPERCASE |
| 4 | CREATE category dengan code duplikat | Status 400 |
| 5 | GET detail category by ID | Status 200 |
| 6 | GET list category dengan pagination | Status 200, nextPage/previousPage ada |
| 7 | SEARCH `?searchTerm=Elektronik&filterColumn=name` | Status 200, data ditemukan |
| 8 | UPDATE category (nama, deskripsi, isActive) | Status 200 |
| 9 | Validasi UUID tidak valid di path param | Status 400 |
| 10 | SOFT DELETE category | Status 200 |
| 11 | Verifikasi soft-delete — GET by ID | Status 400 |
| 12 | Verifikasi `deleted_at` di DB | Field `deletedAt` ada timestamp |

**Catatan Khusus:**
- Code category otomatis dikonversi ke UPPERCASE saat create/update.
- Category yang masih dipakai oleh item aktif **tidak bisa dihapus** (guard akan
  mengembalikan status 400 dengan pesan error yang jelas). Ini diuji di `test-flow-item.ts`.

---

### 📏 UOM Test

**File:** `src/flow-testing-feature/test-flow-uom.ts`
**Command:** `bun run test:flow:uom`

**Skenario yang diuji:**

| No | Skenario | Expected |
|----|----------|----------|
| 1 | Login superadmin | Status 200 |
| 2 | GET list UOM (sebelum create) | Status 200, pagination valid |
| 3 | CREATE UOM pertama (PCS) | Status 200, code UPPERCASE |
| 4 | CREATE UOM kedua (KG) untuk uji pagination | Status 200 |
| 5 | CREATE UOM dengan code duplikat | Status 400 |
| 6 | GET detail UOM by ID | Status 200 |
| 7 | GET list dengan `?page=1&limit=1` — uji pagination ketat | Status 200, hanya 1 record |
| 8 | Verifikasi `nextPageURL` dan `previousPage` di meta | URL terbentuk benar |
| 9 | SEARCH `?searchTerm=Kilogram&filterColumn=name` | Status 200 |
| 10 | SORT `?orderBy={'Name':'ASC'}` | Status 200, urutan benar |
| 11 | UPDATE UOM | Status 200 |
| 12 | SOFT DELETE UOM | Status 200 |
| 13 | Verifikasi soft-delete | Status 400 |

**Catatan Khusus:**
- UOM yang masih dipakai oleh item aktif **tidak bisa dihapus** (guard test).
  Ini diuji secara khusus di `test-flow-item.ts` Bagian C.
- Format `orderBy` menggunakan format JSON string: `{'Field':'ASC'}` atau `{'Field':'DESC'}`.

---

### 📦 Item Test (Single & Package)

**File:** `src/flow-testing-feature/test-flow-item.ts`
**Command:** `bun run test:flow:item`

Test ini adalah yang paling komprehensif, dibagi menjadi 3 bagian.

#### Bagian A — Item Single

| No | Skenario | Expected |
|----|----------|----------|
| 1 | Setup: buat UOM & Category pendukung | Status 200 |
| 2 | CREATE item single dengan barcode | Status 200 |
| 3 | CREATE item dengan code duplikat | Status 400 |
| 4 | GET detail item single — field `details` harus kosong/undefined | Status 200 |
| 5 | GET list filter `?itemType=single` | Status 200 |
| 6 | UPDATE item single (harga, nama) | Status 200 |

#### Bagian B — Item Package

| No | Skenario | Expected |
|----|----------|----------|
| 7 | CREATE item package dengan 2 komponen, diskon 10% | Status 200 |
| 8 | Verifikasi kalkulasi diskon otomatis | `discountPrice` & `priceAfterDiscount` harus benar |
| 9 | GET detail package — field `details` harus berisi komponen | Status 200, `details.length = 2` |
| 10 | CREATE package tanpa field `details` / array kosong | Status 400 |
| 11 | CREATE package dengan `childItemId` yang tidak ada di DB | Status 400, transaction rollback |
| 12 | UPDATE package — ganti komponen & recalculate diskon | Status 200 |
| 13 | GET list filter `?itemType=package` | Status 200 |
| 14 | SOFT DELETE item single & package | Status 200 |

#### Bagian C — Guard Tests (Delete Protection)

| No | Skenario | Expected |
|----|----------|----------|
| 15 | Buat item aktif yang memakai UOM & Category | Status 200 |
| 16 | DELETE UOM yang sedang dipakai item aktif | Status 400, pesan guard error |
| 17 | DELETE Category yang sedang dipakai item aktif | Status 400, pesan guard error |

**Catatan Khusus — Kalkulasi Diskon Otomatis:**

Sistem menghitung `discountPrice` dan `priceAfterDiscount` secara otomatis.
Anda **tidak** perlu mengirim kedua field tersebut saat create/update.

```
sellingPrice      = 100,000
discountPercentage = 10%
─────────────────────────────
discountPrice     = 100,000 × 10% = 10,000
priceAfterDiscount= 100,000 − 10,000 = 90,000
```

Kalkulasi berlaku di 2 level:
1. **Level Paket** (`items` table): diskon untuk harga paket keseluruhan.
2. **Level Komponen** (`item_package_details` table): diskon override per item di dalam paket.

**Catatan Khusus — Harga Override Komponen:**

Harga item di dalam paket (`item_package_details.price`) adalah **override** dari
`selling_price` item satuan. Ini memungkinkan satu item memiliki harga berbeda
ketika dijual satuan vs ketika menjadi bagian dari paket.

```
Item "Charger USB-C":
  selling_price (satuan)       = 80,000
  price di Paket "Starter Kit" = 65,000  ← override, lebih murah di paket
```

---

### 🏗 Master Data Test (All-in-One)

**File:** `src/flow-testing-feature/test-flow-master-data.ts`
**Command:** `bun run test:flow:master-data`

Script master yang menjalankan semua modul secara berurutan dalam satu eksekusi.
Berguna untuk validasi cepat seluruh sistem setelah perubahan besar.

**Urutan eksekusi:**

```
Login Superadmin
    │
    ├─► Module 1: Warehouse (Create, Duplicate, List, Search, Update, Head, Delete)
    │
    ├─► Module 2: Category (Create, Duplicate, List, Search, Update)
    │                 └─ ID category dipakai oleh Module 4
    │
    ├─► Module 3: UOM (Create, Duplicate, List, Sort, Update)
    │                 └─ ID UOM dipakai oleh Module 4
    │
    └─► Module 4: Item (Single, Package, Guard Tests menggunakan UOM & Category di atas)

Final Cleanup (hard delete semua data test)

Laporan Hasil (tabel PASS/FAIL per modul)
```

**Contoh Output Laporan:**

```
╔═══════════════════════════════════════════════════════════════════╗
║                      LAPORAN HASIL TESTING                       ║
╠═══════════════════════════════════════════════════════════════════╣
║  ✅  Warehouse                                                    ║
║  ✅  Category                                                     ║
║  ✅  UOM                                                          ║
║  ✅  Item                                                         ║
╠═══════════════════════════════════════════════════════════════════╣
║  ✅  SEMUA TEST BERHASIL!                                         ║
║  Durasi: 4.82s                                                    ║
╚═══════════════════════════════════════════════════════════════════╝
```

---

## 🔍 Memahami Output Test

### Struktur Output

Setiap test menampilkan output dengan format:

```
╔══════════════════════════════════════════════════════════╗
║        FLOW TESTING: MODUL [NAMA MODUL]                 ║
╚══════════════════════════════════════════════════════════╝

────────────────────────────────────────────────────────────
▶ [Nomor]. [Nama Skenario]
────────────────────────────────────────────────────────────
Status: 200
[Detail response...]
✓ [Keterangan hasil]
```

### Kode Status HTTP yang Umum Muncul

| Status | Arti |
|--------|------|
| `200` | Berhasil |
| `400` | Validasi gagal / data tidak ditemukan / constraint dilanggar |
| `401` | Token tidak valid atau tidak dikirim |
| `500` | Error internal server |

### Exit Code

| Exit Code | Arti |
|-----------|------|
| `0` | Semua test berhasil |
| `1` | Ada test yang gagal |

---

## 🧩 Skenario yang Diuji (Ringkasan)

### Validasi Input

- ✅ Kode duplikat ditolak (`400`)
- ✅ UUID tidak valid di path param ditolak (`400`)
- ✅ Item package tanpa komponen `details` ditolak (`400`)
- ✅ Child item ID yang tidak ada di DB ditolak (`400`) + rollback transaction
- ✅ Child item bertipe `package` tidak bisa jadi komponen package lain (`400`)

### Pagination & Query

- ✅ Query param: `page`, `limit`, `searchTerm`, `filterColumn`, `orderBy`, `itemType`
- ✅ Response selalu menyertakan `PaginationMeta`:
  ```json
  {
    "page": 1,
    "limit": 10,
    "totalRecord": 25,
    "totalPage": 3,
    "nextPage": true,
    "previousPage": false,
    "nextPageURL": "http://localhost:3000/api/items?page=2&limit=10",
    "previousPageURL": "",
    "filterColumn": "name",
    "searchTerm": "charger",
    "orderBy": "{'Name':'ASC'}"
  }
  ```
- ✅ `limit=1000` mengembalikan semua data dalam 1 halaman

### Soft Delete & Guard

- ✅ Soft delete: data tidak dihapus dari DB, hanya `deleted_at` terisi
- ✅ Data yang sudah soft-delete tidak muncul di list maupun GET by ID
- ✅ UOM yang masih dipakai item aktif tidak bisa dihapus
- ✅ Category yang masih dipakai item aktif tidak bisa dihapus

### Fitur Khusus Item Package

- ✅ Kalkulasi diskon otomatis (`discountPrice`, `priceAfterDiscount`)
- ✅ Komponen paket (details) tersimpan dalam `db.transaction()` — atomic rollback
- ✅ GET detail package selalu menyertakan field `details`
- ✅ Harga komponen di paket adalah override dari harga satuan

---

## 🔧 Troubleshooting

### Test Gagal: "Login failed!"

**Penyebab:** Server belum berjalan atau kredensial salah.

```bash
# Pastikan server berjalan
bun run dev

# Pastikan seeding sudah dijalankan
bun run db:seed
```

### Test Gagal: "fetch failed" / Connection Refused

**Penyebab:** Server tidak berjalan di port 3000.

```bash
# Cek apakah port 3000 digunakan
netstat -an | findstr 3000

# Jalankan server
bun run dev
```

### Test Gagal: "CREATE warehouse gagal!" / Status 500

**Penyebab:** Migration belum dijalankan atau ada tabel yang belum ada.

```bash
bun run db:migrate
```

### Test Gagal di tengah jalan & Data Tidak Bersih

Jika test crash sebelum cleanup berjalan, data test mungkin tertinggal di database.
Cari data dengan prefix code seperti `WH-TEST-001`, `CAT-TEST-001`, `UOM-TEST-PCS`, `ITEM-SINGLE-TEST-001` dan hapus secara manual:

```sql
-- Contoh query cleanup manual
DELETE FROM item_package_details WHERE package_item_id IN (
  SELECT id FROM items WHERE code LIKE '%TEST%'
);
DELETE FROM items WHERE code LIKE '%TEST%';
DELETE FROM item_categories WHERE code LIKE '%TEST%';
DELETE FROM uoms WHERE code LIKE '%TEST%';
DELETE FROM warehouse_heads WHERE warehouse_id IN (
  SELECT id FROM warehouses WHERE code LIKE '%TEST%'
);
DELETE FROM warehouses WHERE code LIKE '%TEST%';
```

### Kalkulasi Diskon Tidak Sesuai

Periksa nilai `sellingPrice` dan `discountPercentage` yang dikirim.
Formula yang digunakan sistem:

```
discountPrice      = round(sellingPrice × discountPercentage / 100, 2)
priceAfterDiscount = round(sellingPrice − discountPrice, 2)
```

---

## 📌 Catatan Pengembangan

- Setiap flow test bersifat **self-contained**: membuat data sendiri, melakukan test, lalu membersihkan sendiri.
- Test menggunakan kombinasi **API calls** (fetch ke HTTP endpoint) dan **direct DB queries** (untuk verifikasi dan cleanup).
- Semua file test menggunakan **TypeScript** dan dijalankan langsung dengan **Bun** tanpa perlu kompilasi.
- Server harus berjalan di port `3000` (default). Jika berbeda, ubah konstanta `BASE_URL` di setiap file test.
