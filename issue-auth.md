# Planning Implementasi: Fitur Autentikasi Multimode (Session & OAuth: Google, Facebook, GitLab)

Dokumen ini berisi spesifikasi kebutuhan dan panduan langkah-langkah implementasi (roadmap) untuk pengerjaan fitur login/logout berbasis Session dan integrasi OAuth (Google, Facebook, GitLab) berdampingan dengan login default (username/email & password). 

Dokumen ini ditujukan untuk diimplementasikan oleh Junior Programmer atau AI Model.

---

## 1. Spesifikasi Teknis & Arsitektur

Sistem autentikasi baru ini akan bertransisi atau mendukung metode:
1. **Session-based Authentication**: Dibandingkan stateless JWT murni, sesi login disimpan di database (atau Redis) untuk memungkinkan pencabutan sesi (revoke/force logout) secara real-time.
2. **Multi-provider Login**:
   - **Lokal**: Email & Password default.
   - **OAuth**: Google, Facebook, dan GitLab.
3. **Soft Deletes & Audit Fields**: Seluruh tabel baru wajib memiliki field `created_at`, `updated_at`, `deleted_at` (untuk soft deletes), `created_by`, dan `updated_by`.

---

## 2. Struktur Skema Database Tambahan

Diperlukan tabel-tabel baru untuk mendukung sesi login dan OAuth:

### Tabel `user_sessions`
Menyimpan sesi login aktif pengguna baik dari login lokal maupun OAuth.
- `id` (Primary Key, VARCHAR/UUID) - ID Session / Token Session
- `user_id` (Foreign Key -> `users.id`) - Referensi ke user
- `user_agent` (TEXT, nullable) - Informasi browser/perangkat user
- `ip_address` (VARCHAR, nullable) - IP Address user saat login
- `expires_at` (TIMESTAMP) - Waktu kadaluarsa sesi
- `is_revoked` (BOOLEAN, default: false) - Flag untuk mematikan sesi sebelum expired
- **Audit Fields**: `created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by`

### Tabel `user_oauth_accounts`
Menyimpan mapping akun user lokal dengan provider OAuth pihak ketiga.
- `id` (Primary Key, UUID/Int)
- `user_id` (Foreign Key -> `users.id`) - Menghubungkan ke user utama di sistem
- `provider` (VARCHAR) - Nama provider: `google`, `facebook`, `gitlab`
- `provider_user_id` (VARCHAR) - ID unik user yang diberikan oleh provider (e.g. Google Sub ID)
- `provider_email` (VARCHAR, nullable) - Email dari akun provider
- `access_token` (TEXT, nullable) - Token dari provider (jika diperlukan untuk API call lanjut)
- `refresh_token` (TEXT, nullable) - Refresh token dari provider (jika ada)
- **Audit Fields**: `created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by`

---

## 3. Alur Logika (Flow)

### A. Login Lokal (Email & Password)
1. User mengirimkan `email` & `password`.
2. Validasi kredensial. Jika sukses, buat record baru di `user_sessions`.
3. Set cookie session ID di client (httpOnly, secure) atau kembalikan session token.

### B. Login OAuth (Google / Facebook / GitLab)
1. User mengklik tombol "Login with [Provider]".
2. Frontend/Backend mengarahkan ke URL autentikasi provider.
3. Setelah user menyetujui, provider mengirimkan authorization code kembali ke Redirect URI aplikasi kita.
4. Backend menukarkan code tersebut dengan `access_token` dan profil user (ID & Email) dari API provider.
5. Cek tabel `user_oauth_accounts`:
   - **Skenario A (Sudah Terhubung)**: Jika `provider` & `providerUserId` ditemukan, langsung buat record session di `user_sessions` untuk `userId` terkait.
   - **Skenario B (Belum Terhubung, Email Sama)**: Jika email dari provider cocok dengan user di tabel `users` yang belum terhubung OAuth, buat record di `user_oauth_accounts` lalu buat session.
   - **Skenario C (User Baru)**: Jika tidak ada email yang cocok, buat record baru di `users` (generate random password/null password), buat record `user_oauth_accounts`, kemudian buat session.
6. Arahkan kembali user ke dashboard dengan session aktif.

### C. Logout (Session Revocation)
1. User melakukan request ke `/api/auth/logout`.
2. Backend mengubah `isRevoked` menjadi `true` (atau menghapus data sesi secara soft delete / hard delete dari tabel `user_sessions`) berdasarkan ID Session aktif.
3. Hapus cookie/session di sisi client.

---

## 4. Tabel Rencana Kerja & Tahapan (Planning Table)

| Tahap | Kategori | Tugas / Fitur | Deskripsi Teknis | Output / Deliverable | Status |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **1** | **Database** | Migration & Seeding | Buat tabel `user_sessions` dan `user_oauth_accounts` dengan relasi ke tabel `users` beserta audit fields & soft deletes. | Tabel baru terbuat di PostgreSQL/MySQL via Drizzle/migration tool. | `Todo` |
| **2** | **Backend** | Refactor Schema Drizzle | Sesuaikan file skema Drizzle di `src/db/schema.ts` agar menyertakan relasi user, session, dan oauth accounts beserta field audit & soft deletes. | File `src/db/schema.ts` terupdate. | `Todo` |
| **3** | **Backend** | Integrasi Session Engine | Buat helper/service session manager untuk `createSession`, `validateSession`, dan `revokeSession`. | Session service helper siap pakai. | `Todo` |
| **4** | **Backend** | Refactor Login Lokal | Sesuaikan endpoint login lokal `/api/auth/login` agar setelah verifikasi password berhasil, langsung menggunakan `user_sessions` (Session DB). | API Login Lokal menghasilkan Session ID. | `Todo` |
| **5** | **Backend** | Endpoint & Client OAuth | Integrasikan library OAuth (e.g. `arctic`, `passport`, atau call http langsung) untuk Google, Facebook, dan GitLab. | Route `/api/auth/oauth/[provider]` & callback route. | `Todo` |
| **6** | **Backend** | Refactor Middleware Auth | Ubah `authMiddleware` agar melakukan validasi session ke database `user_sessions` (cek masa aktif dan `isRevoked`). | Middleware auth memvalidasi Session DB. | `Todo` |
| **7** | **Backend** | Refactor Logout | Sesuaikan `/api/auth/logout` untuk mematikan sesi aktif (`isRevoked` = true atau isi `deletedAt` di `user_sessions`). | API logout menghapus/menonaktifkan session. | `Todo` |
| **8** | **Frontend** | Tombol & Flow OAuth | Buat UI Login tambahan dengan tombol login menggunakan Google, Facebook, dan GitLab. | Halaman login terupdate dengan opsi OAuth. | `Todo` |
| **9** | **Pengujian** | Test OAuth & Sessions | Verifikasi skenario login provider, mapping ke user yang sama, pencabutan sesi secara manual di DB (apakah akses terblokir), dan Soft Deletes. | Laporan QA / Manual Test result. | `Todo` |

---

## 5. Standar Kebersihan Kode (Clean Code)

Junior Programmer / AI Model wajib mematuhi standar berikut:
1. **Pemisahan Tanggung Jawab (Separation of Concerns)**: Logic database/query harus di dalam folder `models` atau `repositories` dan untuk penamaan function juga di buatkan interfacenya di folder `interfaces` agar tidak keluar dari scope code yang dibuat, validasi request di `validations`, dan HTTP response routing di `controllers`.
2. **Error Handling Terpusat**: Seluruh catch block harus mengembalikan response error terstandardisasi menggunakan helper response yang sudah ada di `src/utils/response.ts`.
3. **Security Best Practice**: 
   - Jangan pernah menyertakan password, client secrets, atau token OAuth dalam log.
   - Gunakan filter soft delete secara konsisten (`isNull(deletedAt)`).
   - Pastikan session token memiliki panjang entropi yang cukup (min. 32 karakter acak).
