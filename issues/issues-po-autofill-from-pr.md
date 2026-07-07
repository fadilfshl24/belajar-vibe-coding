# Perbaikan Form Pembuatan PO: Otomatisasi List Item dari Purchase Request (PR)

## Deskripsi
Saat ini, di halaman pembuatan Purchase Order (PO), pengguna dapat memilih opsi **"Berdasarkan PR"** (Purchase Request). Namun, setelah PR dipilih, daftar item yang didefinisikan di dalam PR tersebut belum memuat secara otomatis ke tabel detail item PO. Pengguna harus menginput manual kembali, yang mengakibatkan ketidaksinkronan data dan ketidaknyamanan operasional.

Perbaikan ini bertujuan untuk secara otomatis mengisi detail item barang dan memperbarui ringkasan keuangan berdasarkan data dari PR yang dipilih oleh pengguna di form PO.

## Alur Workflow yang Diinginkan
1. **Pemicu Aksi**: Pengguna memilih salah satu dokumen PR dari dropdown select option "Berdasarkan PR".
2. **Pengambilan Data (Fetch PR Detail)**:
   * Frontend memicu pengambilan data detail untuk PR tersebut (menggunakan query `usePRDetail` dengan PR ID terpilih).
3. **Populasi Otomatis Detail Item Form**:
   * Setelah data PR berhasil diambil, ganti seluruh isi `details` di `react-hook-form` dengan daftar item barang (`itemId`, `quantity`, `price` sesuai harga default/purchase price dari item tersebut atau dari harga PR jika ada) yang tertera pada PR tersebut.
   * Gunakan helper `setValue` atau `reset` parsial dari `react-hook-form` untuk memperbarui field array `details`.
4. **Otomatisasi Ringkasan Keuangan**:
   * Setelah list item terisi otomatis dari PR, subtotal dan grand total keuangan (termasuk pajak/PPN, diskon, dan ongkos kirim standar) harus otomatis dihitung ulang dan diperbarui di UI secara real-time.
5. **Kembali Ke Manual (Reset Pilihan)**:
   * Jika pengguna mengubah kembali pilihan PR menjadi "Tanpa PR" (`none`), kosongkan tabel item detail (atau kembalikan ke baris kosong default) agar pengguna dapat melakukan input manual dari awal.
