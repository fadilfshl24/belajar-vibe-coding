# Refactoring Struktur Menu & Role Permissions (Hierarchical Menus)

## Latar Belakang
Saat ini, tabel `menus` hanya memiliki struktur data flat, yang membatasi kemampuan frontend untuk me-render menu secara hierarki (Parent-Child). Diperlukan refactor agar `menus` dapat memiliki parent, dan pemberian akses pada `role_menu_permissions` hanya berlaku untuk child menu (leaf nodes).

## Perubahan Skema Database (Drizzle ORM)

### 1. Tabel `menus`
Tambahkan relasi *self-referencing* untuk mengakomodasi hierarki menu.

**Perubahan Kolom:**
- `parentId` (UUID, nullable): Merujuk ke `menus.id`. Jika null, berarti menu tersebut adalah menu utama (Parent tingkat atas).
- `sortOrder` (Integer, default 0): Untuk mengurutkan posisi menu di UI.

**Implementasi Skema (`menu.schema.ts`):**
```typescript
import { AnyPgColumn } from "drizzle-orm/pg-core";

export const menus = pgTable("menus", {
  id: uuid("id").primaryKey().defaultRandom(),
  parentId: uuid("parent_id").references((): AnyPgColumn => menus.id), // Self-referencing
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 255 }).notNull().unique(),
  path: varchar("path", { length: 255 }).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  ...auditColumns,
});
```

### 2. Tabel `role_menu_permissions`
Struktur tabel `role_menu_permissions` **tidak perlu diubah**, namun **Business Logic (Controller & Model)** untuk memanipulasi tabel ini harus menyesuaikan dengan aturan baru.

## Business Logic & Validation (Backend)

1. **Menu Creation & Update**:
   - Menu dapat dibuat sebagai parent (`parentId: null`) atau child (`parentId` diisi dengan ID parent).
   - Validasi kedalaman (depth): Batasi maksimal 2 level (Parent -> Child) agar UI tidak terlalu kompleks.

2. **Role Permission Assignment**:
   - **ATURAN UTAMA**: Role permission (`can_view`, `can_create`, dll) **HANYA BOLEH** diberikan kepada menu yang **tidak memiliki children** (Leaf nodes).
   - Saat Endpoint `PUT /api/role-permissions` dipanggil, Backend wajib melakukan validasi:
     - Pastikan tidak ada satupun `menuId` dari request yang berstatus sebagai parent (bisa dicek apakah `menuId` tersebut dirujuk oleh row lain di kolom `parentId`).
     - Jika ada parent yang dikirim untuk di-mapping hak aksesnya, kembalikan status `400 Bad Request`.

3. **Get Role Permissions**:
   - Saat frontend meminta daftar hak akses pengguna yang sedang login (`GET /api/auth/me` atau endpoint permissions), backend cukup mengembalikan list permissions untuk child menu saja.

## Panduan Eksekusi untuk Junior Programmer / AI

1. **Update Schema**: Modifikasi `src/modules/menu/menu.schema.ts` sesuai rancangan di atas.
2. **Generate & Run Migration**:
   ```bash
   bun run db:generate
   bun run db:migrate
   ```
3. **Update Validation Schema (Zod)**: Tambahkan `parentId` (opsional) dan `sortOrder` (opsional) ke dalam `createMenuSchema` dan `updateMenuSchema` di `menu.validation.ts`.
4. **Update Menu Model & Controller**: Pastikan `parentId` disimpan ketika menu dibuat/diubah. Saat fetch list menu, Anda bisa mereturn flat array (namun di-order berdasarkan `parentId` dan `sortOrder`), lalu membiarkan Frontend melakukan pembentukan tree (nested JSON).
5. **Update Permission Logic**: Buka `permission.controller.ts` (atau tempat logic bulk update matrix berada), lalu tambahkan validasi `isParentMenu` sebelum melakukan proses simpan/update ke database.

## Notes for Frontend (Informasi Tambahan)
Frontend bertanggung jawab merender navigasi dengan aturan:
- Tampilkan menu "Dashboard" (karena dia child tanpa parent, `parentId = null` dan tidak punya turunan).
- Tampilkan menu "Transaksi" sebagai folder/dropdown JIKA DAN HANYA JIKA user memiliki hak akses minimal (misalnya `can_view`) ke salah satu childnya, yaitu "Barang Masuk" atau "Barang Keluar".
