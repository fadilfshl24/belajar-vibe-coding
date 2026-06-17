# Planning Implementasi: Warehouse Management System (WMS) - Fitur Autentikasi, Role Menu Management, dan Activity Logging

Dokumen ini berisi spesifikasi kebutuhan dan panduan langkah-langkah implementasi (roadmap) untuk dikerjakan oleh Junior Programmer atau AI Model. Implementasi harus dilakukan secara terstruktur sesuai dengan tabel tahapan di bawah ini.

---

## 1. Matriks Akses Menu per Role (Role Menu Mapping)

Secara default, berikut adalah hak akses menu awal yang harus diterapkan ke dalam database/sistem:

| Menu / Fitur | Superadmin | Admin | Warehouse Head | Staff | User | Keterangan |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **Full System Settings** | ✓ | ✗ | ✗ | ✗ | ✗ | Konfigurasi sistem terdalam |
| **Role Menu Management** | ✓ | ✗ | ✗ | ✗ | ✗ | Pengaturan hak akses menu per role secara dinamis |
| **Master Data** | ✓ | ✓ | ✗ | ✗ | ✗ | Pengelolaan data barang, supplier, dll. |
| **Configuration App** | ✓ | ✓ | ✗ | ✗ | ✗ | Pengaturan konfigurasi aplikasi umum |
| **User Management** | ✓ | ✓ | ✗ | ✗ | ✗ | Manajemen akun pengguna (tambah, edit, nonaktifkan) |
| **Warehouse Management** | ✓ | ✓ | ✓ | ✗ | ✗ | Manajemen lokasi & struktur gudang |
| **Inventory Management** | ✓ | ✓ | ✓ | ✗ | ✗ | Monitoring stok barang (keluar/masuk) |
| **Order Management** | ✓ | ✓ | ✗ | ✓ | ✗ | Pembuatan & pemrosesan order keluar-masuk |
| **Activity Log / Monitor** | ✓ | ✓ | ✗ | ✗ | ✗ | Halaman monitoring log aktivitas user |

*Catatan: Sistem harus memiliki tabel penengah yang mengizinkan konfigurasi hak akses ini diubah secara dinamis melalui menu **Role Menu Management** oleh Superadmin.*

---

## 2. Struktur Skema Database (Rekomendasi)

Semua tabel wajib menerapkan sistem **Soft Deletes** (data tidak dihapus permanen secara fisik, melainkan diisi kolom `deleted_at`-nya dan difilter pada setiap query pencarian data aktif). 

Setiap tabel minimal memiliki kolom audit standard berikut:
- `created_at` (TIMESTAMP/DATETIME) - Tanggal data dibuat
- `updated_at` (TIMESTAMP/DATETIME) - Tanggal data terakhir diubah
- `deleted_at` (TIMESTAMP/DATETIME, nullable) - Tanggal data dihapus secara lunak (Soft Delete)
- `created_by` (UUID/Int, nullable) - ID User pembuat data (relasi ke `users.id`)
- `updated_by` (UUID/Int, nullable) - ID User pengubah data (relasi ke `users.id`)

Berikut adalah rancangan detail masing-masing tabel:

### Tabel `roles`
Menyimpan daftar role yang ada di sistem.
- `id` (Primary Key, UUID/Int)
- `name` (VARCHAR: superadmin, admin, warehouse_head, staff, user)
- `description` (TEXT)
- Kolom Audit & Soft Delete (`created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by`)

### Tabel `menus`
Menyimpan daftar menu/fitur yang tersedia di aplikasi.
- `id` (Primary Key, UUID/Int)
- `name` (VARCHAR, e.g., "Master Data", "Order Management")
- `code` (VARCHAR, e.g., "master_data", "order_management") - digunakan sebagai identifier di frontend/backend
- `path` (VARCHAR, e.g., "/master-data")
- Kolom Audit & Soft Delete (`created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by`)

### Tabel `role_menu_permissions`
Tabel mapping untuk menentukan menu apa saja yang bisa diakses oleh role tertentu.
- `id` (Primary Key)
- `role_id` (Foreign Key -> `roles.id`)
- `menu_id` (Foreign Key -> `menus.id`)
- `can_view` (BOOLEAN)
- `can_create` (BOOLEAN)
- `can_update` (BOOLEAN)
- `can_delete` (BOOLEAN)
- Kolom Audit & Soft Delete (`created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by`)

### Tabel `activity_logs`
Menyimpan log audit aktivitas pengguna (log bersifat append-only, soft delete bersifat opsional tetapi ditambahkan kolom audit untuk standardisasi).
- `id` (Primary Key, UUID/Int)
- `user_id` (Foreign Key -> `users.id`, nullable jika aksi guest/sistem)
- `username` (VARCHAR - disimpan untuk mempermudah audit jika user didelete)
- `action` (VARCHAR, e.g., "LOGIN", "LOGOUT", "CREATE_DATA", "UPDATE_ORDER", dll.)
- `description` (TEXT, e.g., "User A created a new item: Kertas HVS A4")
- `ip_address` (VARCHAR, optional)
- `user_agent` (VARCHAR, optional)
- Kolom Audit & Soft Delete (`created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by`)

---

## 3. Tabel Rencana Kerja & Tahapan Implementasi (Planning Table)

Gunakan tabel di bawah ini sebagai checklist progress pengerjaan. Selesaikan per tahapan secara berurutan.

| Tahap | Kategori | Tugas / Fitur | Deskripsi Teknis | Output / Deliverable | Status (Todo/Progress/Done) |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **1** | **Database** | Migrasi Skema DB | Buat migration file untuk tabel `roles`, `menus`, `role_menu_permissions`, dan `activity_logs` beserta relasinya. | Skema tabel terbuat di Database. | `Todo` |
| **2** | **Database** | Database Seeding | Lakukan seeding data awal untuk daftar `roles` (5 roles), daftar `menus`, dan mapping default di `role_menu_permissions`. | Akun default (Superadmin) siap dipakai. | `Todo` |
| **3** | **Backend** | API Auth & Session | Implementasi API Login & Logout dengan JWT/Session. Simpan informasi `role` di payload token. | `/api/auth/login`, `/api/auth/logout`. | `Todo` |
| **4** | **Backend** | Middleware Hak Akses | Buat Middleware/Guard yang mengecek permission di `role_menu_permissions` sebelum mengizinkan request ke API menu terkait. | Middleware/Guard Backend. | `Todo` |
| **5** | **Backend** | API Role Menu Management | Buat API untuk mengambil list mapping permission dan melakukan update permission per role (khusus Superadmin). | GET & PUT `/api/role-permissions`. | `Todo` |
| **6** | **Backend** | Activity Logger Helper | Buat helper/utility function global `logActivity(userId, action, description)` untuk mencatat log ke tabel `activity_logs`. | Logger function siap dipanggil di controller. | `Todo` |
| **7** | **Backend** | Logging Integrasi | Pasang helper `logActivity` di setiap controller/handler: Auth (login/logout), CRUD data master/warehouse, dan CRUD order. | Log tercatat otomatis saat ada aktivitas. | `Todo` |
| **8** | **Frontend** | Desain Menu Dinamis | Buat layout sidebar/navigasi yang merender menu secara dinamis berdasarkan respons API permission user yang sedang login. | Navigasi hanya menampilkan menu yang diizinkan. | `Todo` |
| **9** | **Frontend** | Proteksi Router Frontend | Implementasi router guard di frontend (React/Vue/NextJS) agar user tidak bisa mengetik URL menu yang tidak diizinkan secara manual. | Redirect ke 403 Forbidden jika melanggar. | `Todo` |
| **10**| **Frontend** | UI Role Menu Management | Halaman khusus Superadmin untuk mencentang/mengubah hak akses (View/Create/Update/Delete) per role terhadap menu-menu yang ada. | Halaman tabel matriks permission + tombol save. | `Todo` |
| **11**| **Frontend** | UI Halaman Activity Logs | Buat halaman tabel log aktivitas yang menampilkan data dari tabel `activity_logs` (lengkap dengan filter tanggal, pencarian, & filter user). | Tabel log aktivitas dengan pagination. | `Todo` |
| **12**| **Pengujian** | Uji Coba & QA | Lakukan testing skenario login tiap role, uji pembatasan menu, uji perubahan hak akses dinamis, dan verifikasi pencatatan log. | Dokumen hasil test unit / manual. | `Todo` |

---

## 4. Panduan Format Logging Aktivitas

Gunakan format standard berikut saat mencatat log agar data mudah dibaca di halaman Monitoring Log:

1. **Aksi Login**: 
   - Action: `LOGIN`
   - Description: `User [Username] berhasil masuk ke sistem`
2. **Aksi Logout**: 
   - Action: `LOGOUT`
   - Description: `User [Username] keluar dari sistem`
3. **Aksi Tambah Data (General/Master)**: 
   - Action: `CREATE_DATA`
   - Description: `User [Username] menambahkan data [Nama Entitas] dengan ID [ID]`
4. **Aksi Ubah Data (General/Master)**: 
   - Action: `UPDATE_DATA`
   - Description: `User [Username] mengubah data [Nama Entitas] ID [ID]. Perubahan: [Field A] ([Old] -> [New])`
5. **Aksi Hapus Data (General/Master)**: 
   - Action: `DELETE_DATA`
   - Description: `User [Username] menghapus data [Nama Entitas] ID [ID]`
6. **Aksi Tambah Order**: 
   - Action: `CREATE_ORDER`
   - Description: `User [Username] membuat order baru dengan kode [OrderCode] senilai [TotalAmount]`
7. **Aksi Ubah Order**: 
   - Action: `UPDATE_ORDER`
   - Description: `User [Username] mengubah status order [OrderCode] menjadi [NewStatus]`
8. **Aksi Hapus Order**: 
   - Action: `DELETE_ORDER`
   - Description: `User [Username] menghapus order [OrderCode]`

---
*Petunjuk untuk Implementer: Silakan buat branch baru `feature/wms-role-logging` dan lakukan commit secara bertahap merujuk ke ID Tahap di Tabel Rencana Kerja.*
