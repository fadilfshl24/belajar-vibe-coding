# Issue: Pembuatan Modul Transaksi & Inventory untuk Real-time Dashboard

## Deskripsi
Saat ini Dashboard WMS menampilkan data dummy (mock) untuk pergerakan barang (Barang Masuk, Barang Keluar, dan Stok Menipis). Agar Dashboard bisa merepresentasikan data real-time, kita membutuhkan struktur database dan API untuk mengelola **Transaksi/Stock Orders** (Inbound & Outbound) serta **Inventory/Stok Barang**.

## Tujuan
1. Membangun struktur database `transactions`, `transaction_items`, dan `inventory_stocks`.
2. Menyediakan API Endpoint untuk Modul Transaksi (Create, Update, Approve/Complete Transaksi).
3. Memastikan saat Transaksi (In/Out) selesai (Completed), stok barang di tabel `inventory_stocks` ter-update secara otomatis.
4. Menyediakan API Dashboard (`/api/dashboard/...`) yang mengambil data analitik dari tabel-tabel transaksi dan stok yang baru dibuat.
5. Mengintegrasikan Frontend Dashboard dengan API Dashboard.

## Struktur Tabel (Draft)
- `transactions`: Menyimpan header transaksi (Type: IN/OUT, Warehouse, Date, Status, Reference Number).
- `transaction_items`: Menyimpan detail item dan kuantitas dari setiap transaksi.
- `inventory_stocks`: Menyimpan jumlah stok per barang di setiap gudang.

## Acceptance Criteria
- [ ] User bisa mencatat barang masuk (Inbound).
- [ ] User bisa mencatat barang keluar (Outbound).
- [ ] Stok barang otomatis berkurang/bertambah saat transaksi diselesaikan.
- [ ] Dashboard menampilkan data KPI, Grafik, dan Aktivitas terbaru berdasarkan data transaksi dari API.
