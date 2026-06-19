# Implementation Plan: Issue #11 — Modul Master Data + Pagination + DB Indexing

## Deskripsi

Implementasi modul-modul Master Data baru sesuai Issue #11:

- **Warehouse** (perluasan schema yang sudah ada)
- **Category Item**
- **UOM (Unit of Measurement)**
- **Item** (termasuk tipe `single` dan `package`)
- **Item Package Details** (komponen penyusun item bertipe paket)

Selain itu, semua modul yang sudah ada (**Role, Menu, Permission, ActivityLog, User**) akan di-retrofit dengan **pagination API** yang konsisten. Semua schema juga akan dilengkapi dengan **DB Indexes** menggunakan Drizzle ORM untuk mempercepat query.

---

## User Review Required

> [!IMPORTANT]
> **Persetujuan diperlukan** sebelum eksekusi. Harap review seluruh rencana ini lalu beri konfirmasi untuk memulai.

> [!WARNING]
> Perluasan schema `warehouses` yang sudah ada akan menghasilkan **migration file baru**. Pastikan backup database sebelum menjalankan `bun run db:migrate`.

> [!WARNING]
> Modul `Role` dan `Menu` saat ini **tidak memiliki pagination** — method `findAll()` mengembalikan semua data tanpa limit. Retrofit ini akan mengubah signature method dan response format di `getAll()` controller.

---

## Open Questions — ✅ Semua Terjawab

**Q1 — Filter Pagination Permission**: Tambahkan filter `role_id` dan `menu_id` sebagai query param opsional di endpoint `GET /api/permissions`.

**Q2 — Harga Komponen Paket**: Harga di `item_package_details` adalah **override** dari harga satuan item individual. Artinya, satu item bisa memiliki harga berbeda ketika dijual satuan vs ketika dijual sebagai bagian dari paket.

**Q3 — Kode Wilayah Administratif**: Simpan dalam bentuk **kode/ID** (VARCHAR), disesuaikan dengan data source resmi (misal BPS/Kemendagri) yang akan diintegrasikan kemudian.

---

## Proposed Changes

### ─── PART 1: Schema Baru & Indexing ───

#### [MODIFY] [warehouse.schema.ts](file:///d:/_Code/vibe-coding/belajar-vibe-coding/src/modules/warehouse/warehouse.schema.ts)

- Tambahkan kolom yang belum ada: `description`, `province`, `city_regency`, `district`, `village`, `zip_code`, `latitude`, `longitude`, `is_active`
- Tambahkan tabel **baru** `warehouseHeads` (pivot warehouse ↔ user untuk approval transaksi)
- Tambahkan **DB Indexes**: `idx_warehouses_code`, `idx_warehouses_is_active`, `idx_warehouses_deleted_at`, `idx_warehouse_heads_warehouse_id`, `idx_warehouse_heads_user_id`

#### [NEW] [category.schema.ts](file:///d:/_Code/vibe-coding/belajar-vibe-coding/src/modules/category/category.schema.ts)

```
src/modules/category/category.schema.ts
```

- Tabel `item_categories`: `id, code, name, description, is_active` + auditColumns
- Indexes: `idx_item_categories_code`, `idx_item_categories_is_active`, `idx_item_categories_deleted_at`

#### [NEW] [uom.schema.ts](file:///d:/_Code/vibe-coding/belajar-vibe-coding/src/modules/uom/uom.schema.ts)

```
src/modules/uom/uom.schema.ts
```

- Tabel `uoms`: `id, code, name, description, is_active` + auditColumns
- Indexes: `idx_uoms_code`, `idx_uoms_is_active`, `idx_uoms_deleted_at`

#### [NEW] [item.schema.ts](file:///d:/_Code/vibe-coding/belajar-vibe-coding/src/modules/item/item.schema.ts)

```
src/modules/item/item.schema.ts
```

- Enum `item_type`: `single | package`
- Tabel `items`: `id, code, name, description, uom_id (FK), category_id (FK), barcode_text, barcode_type, image_url, item_type, purchase_price, selling_price, is_active, discount_percentage, discount_price, price_after_discount` + auditColumns
- Tabel `item_package_details`: `id, package_item_id (FK→items), child_item_id (FK→items), quantity, is_active, price, discount_percentage, discount_price, price_after_discount` + auditColumns
- Indexes pada `items`: `idx_items_code`, `idx_items_uom_id`, `idx_items_category_id`, `idx_items_item_type`, `idx_items_is_active`, `idx_items_deleted_at`, `idx_items_barcode_text`
- Indexes pada `item_package_details`: `idx_item_pkg_details_package_item_id`, `idx_item_pkg_details_child_item_id`

#### Tambahan Indexes pada Schema yang Sudah Ada

| Schema | Indexes yang Ditambahkan |
|---|---|
| `user.schema.ts` | `idx_users_email`, `idx_users_status`, `idx_users_deleted_at` |
| `role.schema.ts` | `idx_roles_name`, `idx_roles_deleted_at`, `idx_uwr_user_id`, `idx_uwr_warehouse_id`, `idx_uwr_role_id` |
| `menu.schema.ts` | `idx_menus_code`, `idx_menus_deleted_at` |
| `permission.schema.ts` | `idx_rmp_role_id`, `idx_rmp_menu_id` |
| `auth.schema.ts` | `idx_user_sessions_user_id`, `idx_user_sessions_expires_at` |
| `activity-log.schema.ts` | `idx_activity_logs_user_id`, `idx_activity_logs_action`, `idx_activity_logs_created_at` |

---

### ─── PART 2: Modul Baru — Category ───

#### [NEW] `src/modules/category/`

```
category.schema.ts     ✓ (disebutkan di atas)
category.validation.ts — Zod schema: createCategorySchema, updateCategorySchema, listQuerySchema
category.dto.ts        — interface CategoryDTO + toDTO mapper
category.model.ts      — CategoryModel: findAll(paginated), findById, findByCode, create, update, softDelete, countAll
category.controller.ts — CategoryController: getAll (paginated), getById, create, update, remove
category.routes.ts     — GET /api/categories, GET /api/categories/:id, POST, PUT, DELETE
index.ts               — export routes & schema
```

---

### ─── PART 3: Modul Baru — UOM ───

#### [NEW] `src/modules/uom/`

```
uom.schema.ts          ✓ (disebutkan di atas)
uom.validation.ts      — Zod schema: createUomSchema, updateUomSchema, listQuerySchema
uom.dto.ts             — interface UomDTO + toDTO mapper
uom.model.ts           — UomModel: findAll(paginated), findById, findByCode, create, update, softDelete, countAll
uom.controller.ts      — UomController: getAll (paginated), getById, create, update, remove
uom.routes.ts          — GET /api/uoms, GET /api/uoms/:id, POST, PUT, DELETE
index.ts               — export routes & schema
```

---

### ─── PART 4: Modul Baru — Item (termasuk Package) ───

#### [NEW] `src/modules/item/`

```
item.schema.ts         ✓ (disebutkan di atas)
item.validation.ts     — Zod schema untuk create/update, termasuk validasi array `details` untuk tipe package
item.dto.ts            — interface ItemDTO, ItemDetailDTO + mapper
item.model.ts          — ItemModel: findAll(paginated), findById, findByCode, create (dengan db.transaction untuk package), update, softDelete, countAll
item.controller.ts     — ItemController: getAll (paginated), getById, create, update, remove
                         * Business logic kalkulasi diskon otomatis pada create/update
                         * Validasi: child_item_id hanya boleh item bertipe 'single'
                         * Wrap insert item + details dalam db.transaction()
item.routes.ts         — GET /api/items, GET /api/items/:id, POST, PUT, DELETE
index.ts               — export routes & schema
```

---

### ─── PART 5: Perluasan Modul Warehouse ───

#### [MODIFY] [warehouse.schema.ts](file:///d:/_Code/vibe-coding/belajar-vibe-coding/src/modules/warehouse/warehouse.schema.ts)

- Modifikasi schema seperti dijelaskan di Part 1

#### [NEW] File-file baru di `src/modules/warehouse/`

```
warehouse.validation.ts — createWarehouseSchema, updateWarehouseSchema, createWarehouseHeadSchema, listQuerySchema
warehouse.dto.ts        — WarehouseDTO, WarehouseHeadDTO + mapper
warehouse.model.ts      — WarehouseModel: findAll(paginated), findById, findByCode, create, update, softDelete, countAll
                          WarehouseHeadModel: findByWarehouse, create, softDelete
warehouse.controller.ts — WarehouseController: getAll (paginated), getById, create, update, remove
                          WarehouseHeadController: getByWarehouse, assign, unassign
warehouse.routes.ts     — Full CRUD routes termasuk /api/warehouses/:id/heads
```

---

### ─── PART 6: Retrofit Pagination pada Modul yang Ada ───

Semua modul berikut tidak memiliki pagination di `getAll()`. Pattern yang digunakan mengacu pada implementasi di `UserController.getAll()` yang sudah ada sebagai referensi terbaik.

#### [MODIFY] [role.model.ts](file:///d:/_Code/vibe-coding/belajar-vibe-coding/src/modules/role/role.model.ts)

- Tambahkan parameter `{ page, limit, orderBy, searchTerm, filterColumn }` ke `findAll()`
- Tambahkan method `countAll(searchTerm?, filterColumn?)`

#### [MODIFY] [role.controller.ts](file:///d:/_Code/vibe-coding/belajar-vibe-coding/src/modules/role/role.controller.ts)

- Update `getAll()` untuk membaca query params dan mengembalikan `PaginationMeta`

#### [MODIFY] [menu.model.ts](file:///d:/_Code/vibe-coding/belajar-vibe-coding/src/modules/menu/menu.model.ts)

- Tambahkan parameter pagination ke `findAll()`
- Tambahkan method `countAll()`

#### [MODIFY] [menu.controller.ts](file:///d:/_Code/vibe-coding/belajar-vibe-coding/src/modules/menu/menu.controller.ts)

- Update `getAll()` dengan pagination support

#### Modul `permission` dan `activity-log`

- Sama seperti di atas, update model dan controller untuk mendukung pagination

---

### ─── PART 7: Registrasi Modul Baru di app.ts ───

#### [MODIFY] [app.ts](file:///d:/_Code/vibe-coding/belajar-vibe-coding/src/app.ts)

- Import dan register routes baru: `categoryRoutes`, `uomRoutes`, `itemRoutes`
- Warehouse sudah terdaftar (tapi routesnya belum ada — perlu dibuat)

---

## Ringkasan File Baru & Modifikasi

### File Baru (NEW)

| Path | Keterangan |
|---|---|
| `src/modules/category/category.schema.ts` | Schema DB kategori |
| `src/modules/category/category.validation.ts` | Zod validation |
| `src/modules/category/category.dto.ts` | DTO mapper |
| `src/modules/category/category.model.ts` | DB queries |
| `src/modules/category/category.controller.ts` | Request handlers |
| `src/modules/category/category.routes.ts` | Elysia routes |
| `src/modules/category/index.ts` | Module export |
| `src/modules/uom/uom.schema.ts` | Schema DB UOM |
| `src/modules/uom/uom.validation.ts` | Zod validation |
| `src/modules/uom/uom.dto.ts` | DTO mapper |
| `src/modules/uom/uom.model.ts` | DB queries |
| `src/modules/uom/uom.controller.ts` | Request handlers |
| `src/modules/uom/uom.routes.ts` | Elysia routes |
| `src/modules/uom/index.ts` | Module export |
| `src/modules/item/item.schema.ts` | Schema DB item + package_details |
| `src/modules/item/item.validation.ts` | Zod validation (termasuk array details) |
| `src/modules/item/item.dto.ts` | DTO mapper |
| `src/modules/item/item.model.ts` | DB queries + db.transaction |
| `src/modules/item/item.controller.ts` | Request handlers + kalkulasi diskon |
| `src/modules/item/item.routes.ts` | Elysia routes |
| `src/modules/item/index.ts` | Module export |
| `src/modules/warehouse/warehouse.validation.ts` | Zod validation warehouse |
| `src/modules/warehouse/warehouse.dto.ts` | DTO mapper |
| `src/modules/warehouse/warehouse.model.ts` | DB queries |
| `src/modules/warehouse/warehouse.controller.ts` | Request handlers |
| `src/modules/warehouse/warehouse.routes.ts` | Elysia routes |

### File yang Dimodifikasi (MODIFY)

| Path | Perubahan |
|---|---|
| `src/modules/warehouse/warehouse.schema.ts` | Tambah kolom + tabel warehouseHeads + indexes |
| `src/modules/warehouse/index.ts` | Export routes & schema baru |
| `src/modules/user/user.schema.ts` | Tambah indexes |
| `src/modules/role/role.schema.ts` | Tambah indexes |
| `src/modules/role/role.model.ts` | Pagination support |
| `src/modules/role/role.controller.ts` | Pagination pada getAll |
| `src/modules/menu/menu.schema.ts` | Tambah indexes |
| `src/modules/menu/menu.model.ts` | Pagination support |
| `src/modules/menu/menu.controller.ts` | Pagination pada getAll |
| `src/modules/permission/permission.schema.ts` | Tambah indexes |
| `src/modules/auth/auth.schema.ts` | Tambah indexes |
| `src/modules/activity-log/activity-log.schema.ts` | Tambah indexes |
| `src/app.ts` | Register modul baru |

---

## Verification Plan

### Automated Tests (Migration)

```bash
# Generate migration dari perubahan schema
bun run db:generate

# Apply migration ke database
bun run db:migrate

# Jalankan server dan pastikan semua route terdaftar
bun run dev
```

### Manual API Testing (Postman / Bruno / curl)

**Modul Category:**

- `POST /api/categories` → Buat category baru, validasi code unique
- `GET /api/categories?page=1&limit=5&searchTerm=...` → Pastikan pagination berjalan
- `PUT /api/categories/:id` → Update, pastikan log activity tercatat
- `DELETE /api/categories/:id` → Soft delete, data tidak hilang dari DB

**Modul UOM:**

- Sama seperti Category

**Modul Warehouse:**

- `POST /api/warehouses` → Buat dengan koordinat GPS, pastikan tersimpan dengan presisi desimal yang benar
- `POST /api/warehouses/:id/heads` → Assign user sebagai kepala gudang
- Coba hapus UOM/Category yang dipakai oleh Item aktif → harus `400 Bad Request`

**Modul Item:**

- `POST /api/items` dengan `item_type: "single"` → Berhasil tanpa details
- `POST /api/items` dengan `item_type: "package"` dan array `details` → Tersimpan dalam satu transaksi
- `POST /api/items` dengan package + `child_item_id` yang tidak valid → `400` + rollback
- Verifikasi kalkulasi otomatis: harga 100000, diskon 10% → `discount_price: 10000`, `price_after_discount: 90000`

**Retrofit Pagination (Existing Modules):**

- `GET /api/roles?page=1&limit=5` → Pastikan response mengandung `meta.pagination`
- `GET /api/menus?page=1&limit=5` → Sama
