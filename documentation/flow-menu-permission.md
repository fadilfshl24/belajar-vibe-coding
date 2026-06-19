# Documentation: Hierarchical Menus & Role Permissions (Issue #13)

## Deskripsi Implementasi

Fitur ini mengimplementasikan kemampuan sistem untuk menyusun menu dalam bentuk hierarki (Parent-Child) dan membatasi pengaturan hak akses (Role Permissions) secara ketat hanya pada menu di tingkat terbawah (*leaf nodes*).

### 1. Perubahan Database Schema (Drizzle ORM)

Tabel `menus` telah diperluas dengan penambahan dua kolom baru:

- `parentId` (UUID, nullable): Merupakan *self-referencing foreign key* ke `menus.id`. Jika bernilai `null`, menu tersebut adalah menu parent tingkat teratas.
- `sortOrder` (Integer): Menyimpan urutan (wajib diisi dengan nilai default 0 di sisi DB) untuk mempermudah *rendering* urutan menu di Frontend.

*Catatan: Migration file telah digenerate dan diaplikasikan ke database.*

### 2. Validasi & Data Transfer Object (DTO)

- **Menu Validation (`menu.validation.ts`)**: `createMenuSchema` dan `updateMenuSchema` telah diperbarui untuk mewajibkan input `sortOrder` dan menerima `parentId` (opsional).
- **Menu DTO (`menu.dto.ts`)**: `MenuDTO` sekarang mengekspos properti `parentId` dan `sortOrder` agar Frontend dapat merender struktur *Tree* dengan mudah.

### 3. Business Logic & Proteksi Penghapusan

Di `menu.model.ts` dan `menu.controller.ts`, fungsi `softDelete` telah diperkuat dengan validasi berikut:

- Sebelum sebuah menu dihapus, sistem akan mengecek apakah menu tersebut menjadi parent bagi menu lain (memiliki *children* aktif).
- Jika memiliki *children* aktif, sistem akan membatalkan penghapusan dan melempar *HTTP Status Code* `400 Bad Request` dengan pesan: `"Cannot delete menu because it has active children"`. Hal ini diimplementasikan untuk mencegah hilangnya hierarki (yatim piatu / *orphans*) dan menolak potensi bug di sistem aplikasi klien.

### 4. Validasi Role Permissions

Sesuai dengan aturan bisnis yang disepakati, **Hak Akses tidak boleh diberikan pada Parent Menu**. Menu induk hanya berfungsi sebagai folder pengelompokan.

- **Fungsi Pemeriksa (`permission.model.ts`)**: Fungsi `getParentMenuIds(menuIds)` ditambahkan untuk memindai sekumpulan ID menu yang di-request dan menemukan apakah ada di antaranya yang saat ini dirujuk sebagai Parent oleh tabel menu.
- **Integrasi di Controller (`permission.controller.ts`)**: Pada endpoint `bulkUpdate` Role Permission, sistem kini mencegat request jika ada minimal satu ID Parent yang terdeteksi. Sistem akan membatalkan perubahan dan melempar *HTTP Status Code* `400 Bad Request` dengan pesan: `"Tidak bisa memberikan permission pada Parent Menu"`.

---

## Ringkasan File yang Dimodifikasi

| Path | Keterangan Perubahan |
|---|---|
| `src/modules/menu/menu.schema.ts` | Tambah kolom `parentId` & `sortOrder` |
| `src/modules/menu/menu.validation.ts` | Zod schema: tambah `sortOrder` (wajib), `parentId` (opsional) |
| `src/modules/menu/menu.dto.ts` | Mapping `parentId` & `sortOrder` pada response API |
| `src/modules/menu/menu.model.ts` | Logic parameter baru + pencegahan hapus Parent |
| `src/modules/menu/menu.controller.ts` | Parsing error dari Model agar menjadi HTTP 400 |
| `src/modules/permission/permission.model.ts` | Tambah helper db query `getParentMenuIds` |
| `src/modules/permission/permission.controller.ts` | Intersepsi blokir save jika berisi Parent Menu |

---
