# Rencana Implementasi: Modul Master Data (Category, Warehouse, UOM, Item, & Package)

Perencanaan ini dibuat sebagai panduan teknis yang detail untuk diimplementasikan oleh junior programmer atau AI model. Implementasi harus mengikuti standar arsitektur dan pola coding yang sudah ada di codebase (menggunakan Elysia, Drizzle ORM, PostgreSQL, dan Zod).

---

## 1. Analisis & Feedback Arsitektur (Sebelum Implementasi)

Sebelum menulis kode, harap perhatikan beberapa penyesuaian flow system dan struktur tabel berikut agar sistem lebih fleksibel dan terhindar dari logical bug:

### A. Penyatuan Konsep Item dan Package (Rekomendasi Utama)
* **Temuan**: Pada draf perencanaan, terdapat kolom `item_type` (`single` / `package`) pada tabel `items`, tetapi di sisi lain terdapat tabel `packages` dan `packages_detail` terpisah. Ini menyebabkan redundansi data dan kompleksitas flow transaksi (misal: jika ada penjualan, API harus mengecek ke dua tabel berbeda).
* **Solusi/Adjustments**: Satukan semua ke dalam tabel `items`. 
  * Jika barang adalah tipe `single`, ia tidak memiliki komponen.
  * Jika barang adalah tipe `package`, data master tersimpan di tabel `items` (dengan `item_type = 'package'`), dan komponen penyusunnya didefinisikan di tabel `item_packages` (sebagai pengganti `packages_detail`).
  * Hal ini membuat flow transaksi jauh lebih bersih karena semua transaksi (order, stock mutasi, stock opname) cukup merujuk pada `item_id`.

### B. Tipe Data Kode Wilayah Administratif pada Warehouse
* **Temuan**: Kolom `province`, `city_regencie` (typo: regency), `district`, dan `village` didefinisikan sebagai `INT`.
* **Solusi/Adjustments**: Kode wilayah administratif resmi (misalnya dari Kemendagri/BPS di Indonesia) sering kali mengandung format titik (contoh: `31.73.05.1002`) atau angka dengan angka nol di depan (leading zeros, contoh: `01` untuk provinsi tertentu). Jika disimpan sebagai `INT`, angka nol di depan akan hilang. Ubah tipe datanya menjadi `VARCHAR` (length 10-20).
* **Typo**: Ubah nama kolom `city_regencie` menjadi `city_regency` agar sesuai dengan tata bahasa Inggris yang benar.

### C. Skala Desimal untuk Koordinat GPS
* **Temuan**: `latitude` dan `longitude` bertipe `DECIMAL` tanpa kejelasan presisi.
* **Solusi/Adjustments**: Gunakan presisi dan skala yang tepat untuk koordinat peta:
  * Latitude: `decimal("latitude", { precision: 10, scale: 8 })`
  * Longitude: `decimal("longitude", { precision: 11, scale: 8 })`

### D. Konsep Stok Barang (Inventory Stocks)
* **Temuan**: Modul ini berfokus pada master data, namun perlu diingat bahwa dalam WMS, **stok barang disimpan per gudang**.
* **Solusi/Adjustments**: Jangan pernah menambahkan kolom `stock` langsung di dalam master data `items`. Hubungan stok harus dijembatani oleh tabel transaksi atau tabel mapping stok seperti `inventory_stocks` (yang memetakan `warehouse_id`, `item_id`, dan `quantity`).

### E. Perhitungan Otomatis Diskon & Harga Paket
* **Temuan**: Field diskon dan harga setelah diskon disimpan di database.
* **Solusi/Adjustments**: Pastikan pada layer service/controller terdapat validasi otomatis untuk menghitung nilai harga setelah diskon:
  $$\text{discount\_price} = \text{price} \times \left(\frac{\text{discount\_percentage}}{100}\right)$$
  $$\text{price\_after\_discount} = \text{price} - \text{discount\_price}$$

---

## 2. Struktur Database (Drizzle ORM Schema)

Implementasikan skema database di folder masing-masing modul. Gunakan helper `auditColumns` dari `src/core/db/audit.ts` untuk melacak log perubahan dan mendukung fitur soft-delete (`deletedAt`).

### A. Modul: Warehouse (`src/modules/warehouse/warehouse.schema.ts`)
Modifikasi skema `warehouses` yang sudah ada dan tambahkan tabel pivot `warehouse_heads` (untuk approval transaksi).

```typescript
import { pgTable, uuid, varchar, text, decimal, boolean } from "drizzle-orm/pg-core";
import { auditColumns } from "../../core/db/audit";
import { users } from "../user/user.schema";

export const warehouses = pgTable("warehouses", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  address: text("address"),
  province: varchar("province", { length: 50 }),
  cityRegency: varchar("city_regency", { length: 50 }),
  district: varchar("district", { length: 50 }),
  village: varchar("village", { length: 50 }),
  zipCode: varchar("zip_code", { length: 10 }),
  latitude: decimal("latitude", { precision: 10, scale: 8 }),
  longitude: decimal("longitude", { precision: 11, scale: 8 }),
  isActive: boolean("is_active").notNull().default(true),
  ...auditColumns,
});

export const warehouseHeads = pgTable("warehouse_heads", {
  id: uuid("id").primaryKey().defaultRandom(),
  warehouseId: uuid("warehouse_id")
    .notNull()
    .references(() => warehouses.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  isActive: boolean("is_active").notNull().default(true),
  description: text("description"),
  ...auditColumns,
});
```

### B. Modul: Category (`src/modules/category/category.schema.ts`)
```typescript
import { pgTable, uuid, varchar, text, boolean } from "drizzle-orm/pg-core";
import { auditColumns } from "../../core/db/audit";

export const itemCategories = pgTable("item_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  ...auditColumns,
});
```

### C. Modul: UOM (`src/modules/uom/uom.schema.ts`)
```typescript
import { pgTable, uuid, varchar, text, boolean } from "drizzle-orm/pg-core";
import { auditColumns } from "../../core/db/audit";

export const uoms = pgTable("uoms", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  ...auditColumns,
});
```

### D. Modul: Item & Package (`src/modules/item/item.schema.ts`)
```typescript
import { pgTable, uuid, varchar, text, decimal, boolean, pgEnum } from "drizzle-orm/pg-core";
import { auditColumns } from "../../core/db/audit";
import { uoms } from "../uom/uom.schema";
import { itemCategories } from "../category/category.schema";

export const itemTypeEnum = pgEnum("item_type", ["single", "package"]);

export const items = pgTable("items", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  uomId: uuid("uom_id")
    .notNull()
    .references(() => uoms.id),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => itemCategories.id),
  barcodeText: varchar("barcode_text", { length: 150 }).unique(),
  barcodeType: varchar("barcode_type", { length: 50 }), // contoh: EAN-13, CODE-128
  imageUrl: text("image_url"),
  itemType: itemTypeEnum("item_type").notNull().default("single"),
  purchasePrice: decimal("purchase_price", { precision: 15, scale: 2 }).notNull().default("0.00"),
  sellingPrice: decimal("selling_price", { precision: 15, scale: 2 }).notNull().default("0.00"),
  isActive: boolean("is_active").notNull().default(true),
  
  // Field Tambahan untuk tipe Package (Opsional diisi jika itemType = 'package')
  discountPercentage: decimal("discount_percentage", { precision: 5, scale: 2 }).notNull().default("0.00"),
  discountPrice: decimal("discount_price", { precision: 15, scale: 2 }).notNull().default("0.00"),
  priceAfterDiscount: decimal("price_after_discount", { precision: 15, scale: 2 }).notNull().default("0.00"),
  
  ...auditColumns,
});

// Tabel Detail Komponen Package
export const itemPackageDetails = pgTable("item_package_details", {
  id: uuid("id").primaryKey().defaultRandom(),
  packageItemId: uuid("package_item_id")
    .notNull()
    .references(() => items.id, { onDelete: "cascade" }), // Harus mereferensikan item dengan itemType = 'package'
  childItemId: uuid("child_item_id")
    .notNull()
    .references(() => items.id), // Mereferensikan item penyusun (biasanya itemType = 'single')
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull().default("1.00"),
  isActive: boolean("is_active").notNull().default(true),
  
  // Opsional: Kustomisasi harga/diskon per baris komponen dalam paket
  price: decimal("price", { precision: 15, scale: 2 }).notNull().default("0.00"),
  discountPercentage: decimal("discount_percentage", { precision: 5, scale: 2 }).notNull().default("0.00"),
  discountPrice: decimal("discount_price", { precision: 15, scale: 2 }).notNull().default("0.00"),
  priceAfterDiscount: decimal("price_after_discount", { precision: 15, scale: 2 }).notNull().default("0.00"),
  
  ...auditColumns,
});
```

---

## 3. Struktur File Modul (Elysia Pattern)

Setiap modul baru (`warehouse`, `category`, `uom`, dan `item`) harus mengimplementasikan berkas-berkas berikut untuk menjaga konsistensi codebase:

```text
src/modules/<nama-modul>/
├── index.ts               # Registrasi router & export schema
├── <modul>.schema.ts      # Definisi tabel Drizzle
├── <modul>.validation.ts  # Zod schema untuk request validation
├── <modul>.dto.ts         # Data Transfer Object (response mapper)
├── <modul>.model.ts       # Query database (Drizzle queries)
├── <modul>.controller.ts  # Request handler & Business Logic
└── <modul>.routes.ts      # Routing endpoint Elysia
```

### Panduan Implementasi File:

1. **Validation (`*.validation.ts`)**:
   * Buat skema Zod untuk validasi input POST dan PATCH (misalnya: `createWarehouseSchema`, `updateWarehouseSchema`).
   * Validasi format UUID untuk ID relasi (`uomId`, `categoryId`, dll.).
   * Validasi nilai angka agar tidak negatif (misal: harga beli, harga jual, kuantitas).

2. **Model (`*.model.ts`)**:
   * Implementasikan fungsi standar: `findById`, `findAll` (paginated dengan pencarian & filter kolom), `create`, `update`, dan `deleteById` (soft-delete dengan mengisi `deletedAt`).
   * Gunakan static method pada class model (seperti contoh pada `UserModel`).

3. **Controller (`*.controller.ts`)**:
   * Tangani parsing request body dan response menggunakan helper `successResponse` dan `failedResponse`.
   * Tangani pencatatan log aktivitas menggunakan helper `logActivity` (misal ketika menambah atau mengubah item).
   * Lakukan kalkulasi otomatis untuk diskon paket pada saat penambahan/perubahan item bertipe `package`.

4. **Routes (`*.routes.ts`)**:
   * Daftarkan route RESTful standar:
     * `GET /api/<modul>` (list data paginated)
     * `GET /api/<modul>/:id` (detail data)
     * `POST /api/<modul>` (buat data baru)
     * `PATCH /api/<modul>/:id` (update data sebagian)
     * `DELETE /api/<modul>/:id` (soft-delete data)

---

## 4. Flow Validasi & Business Logic Spesifik

### A. Validasi Item & Detail Paket
Saat menyimpan data item baru dengan tipe `package` (`POST /api/items`):
1. Pastikan array `details` (komponen paket) dikirimkan di request body.
2. Validasi bahwa setiap `child_item_id` dalam `details` benar-benar ada di database dan memiliki `item_type = 'single'`.
3. Validasi harga: Pastikan total harga komponen cocok dengan kalkulasi diskon atau berikan keleluasaan harga jual paket yang dihitung otomatis dari total harga komponen setelah dikurangi diskon paket.
4. Lakukan penyimpanan transaksi database dalam satu blok **Transaction** (menggunakan `db.transaction(...)`) agar jika penyimpanan detail gagal, data master item juga di-rollback.

### B. Soft-Delete Cascading (Virtual)
Ketika menghapus data Master:
* **UOM / Category**: Sebelum menghapus UOM atau Category, pastikan tidak ada produk (`items`) aktif yang masih merujuk ke UOM atau Category tersebut. Jika ada, gagalkan proses penghapusan dengan status code `400 Bad Request` dan pesan error yang informatif.
* **Warehouse**: Sebelum menghapus Warehouse, pastikan tidak ada transaksi aktif atau stok tersisa di warehouse tersebut. Hapus data pivot di `warehouse_heads` secara soft-delete atau cascade.

---

## 5. Rencana Pengujian (Verification Plan)

### A. Pengujian Otomatis (Unit / Integration Test)
Buat skrip pengujian atau gunakan manual endpoint testing via Postman/Bruno dengan skenario berikut:
1. **CRUD Warehouse**: Pastikan koordinat tersimpan dengan presisi desimal yang benar dan validasi wilayah administratif bekerja.
2. **UOM & Category Constraint**: Coba hapus UOM yang sedang digunakan oleh suatu `item` dan verifikasi bahwa sistem menolak penghapusan tersebut.
3. **Kalkulasi Diskon Paket**: Kirim request `POST /api/items` untuk tipe paket dengan harga dasar Rp 100.000 dan diskon 10%. Verifikasi bahwa `discountPrice` terisi Rp 10.000 dan `priceAfterDiscount` terisi Rp 90.000 secara otomatis di database.
4. **Validasi Komponen Paket**: Kirim request pembuatan paket dengan `child_item_id` yang tidak valid (tidak ada di db). Verifikasi bahwa sistem mengembalikan error `400` dan transaksi di-rollback sepenuhnya.

### B. Validasi Migrasi DB
Jalankan perintah berikut untuk memastikan migrasi database terbentuk tanpa error:
```bash
bun run db:generate
bun run db:migrate
```
