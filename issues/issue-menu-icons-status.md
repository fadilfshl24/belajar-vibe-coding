# Issue: Dynamic Menu Icons, Status & Database Cleanup

## Deskripsi Masalah
Saat ini, penentuan icon menu di frontend masih bersifat statis (hardcoded map di `DashboardLayout.tsx`). Selain itu, belum ada kolom status keaktifan menu (`isActive`) untuk menonaktifkan menu ketika sedang tidak digunakan atau dalam masa pemeliharaan (maintenance). Kita juga memerlukan mekanisme untuk membersihkan data transaksi/master pada database untuk kebutuhan demo bersih, dengan tetap mempertahankan user admin utama (`adminit@gmail.com`) dan konfigurasi dasarnya.

## Kebutuhan Sistem

### 1. Database Schema (Menus)
Tambahkan dua kolom baru pada tabel `menus`:
- `icon` (varchar, nullable): Menyimpan nama identifier icon (misal: `layout-dashboard`, `package`, dll).
- `isActive` (boolean, default: `true`): Menyimpan status keaktifan menu.

### 2. Backend & Seeder
- Update schema, validation, model, dan DTO menu untuk menyertakan `icon` dan `isActive`.
- Update endpoint `/api/auth/me` agar hanya mengembalikan menu yang aktif (`isActive = true`).
- Update file `menus.seed.ts` untuk menginput default icon dan status `isActive: true` ke seluruh data menu awal.
- Buat sebuah script pembersih database (`clear-db.ts`) yang mengosongkan semua data transaksi dan master (items, categories, uoms, activity logs, dll), tetapi mempertahankan akun `adminit@gmail.com` dan role mapping superadmin-nya.

### 3. Frontend Integration
- Update tipe data `MenuItem` di `AuthContext.tsx`.
- Refaktor `DashboardLayout.tsx` agar mencari dan merender icon Lucide React secara dinamis berdasarkan nilai string `icon` yang dikirim dari database, serta menghapus `ICON_MAP` statis.

## Rencana Verifikasi
- Jalankan migrasi dan seeding, lalu verifikasi bahwa icon di sidebar dimuat secara dinamis dari DB.
- Set salah satu menu `isActive = false` di DB dan pastikan menu tersebut tidak muncul di sidebar frontend serta terblokir oleh Route Guard.
- Jalankan script pembersihan database dan pastikan semua data terhapus kecuali user superadmin.
