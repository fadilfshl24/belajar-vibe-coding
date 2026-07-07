# Fitur Lengkap: Alur Procure-to-Pay & Goods Receipt

## Deskripsi
Saat ini sistem melakukan update penambahan jumlah stok (inventory) langsung ketika `Purchase Request (PR)` disetujui (Approved). Alur ini terlalu instan dan tidak merefleksikan alur pengadaan yang sebenarnya (Procure-to-Pay), di mana barang yang disetujui harus diorder melalui `Purchase Order (PO)`, fisik barang diterima oleh staf Gudang melalui `Goods Receipt (GR)`, dan melewati tahapan pengujian fisik `Quality Control (QC)` sebelum benar-benar dihitung ke dalam stok.

Oleh karena itu, sistem perlu merombak alur pengadaan yang sudah ada menjadi lebih komprehensif.

## Workflow Alur Baru
1. **Purchase Request (PR)**: Karyawan mengajukan PR. Manager melakukan Approval.
2. **Purchase Order (PO)**: 
   * Staff Purchasing akan membuat PO yang merujuk pada PR yang telah di-Approve. 
   * *Fitur Tambahan:* Mendukung **Multi-PR to 1 PO** (Beberapa PR dapat digabungkan menjadi 1 PO ke vendor yang sama).
3. **Goods Receipt (GR) / Penerimaan Barang**:
   * Barang secara fisik datang dari Vendor berdasarkan referensi dari nomor dokumen PO.
   * Staff gudang menghitung kuantitas fisik yang masuk (jumlahnya bisa sama, kurang, atau berlebih dari PO).
4. **Quality Control (QC)**:
   * Barang yang diterima di GR diinspeksi. 
   * Dipisahkan jumlah unit yang Bagus (`Pass`) dan jumlah unit yang Cacat/Kurang (`Reject`).
   * Barang yang cacat/reject dicatat alasannya demi audit trail log yang transparan.
5. **Inventory Update (Stock In) & Laporan Cacat**:
   * **Validasi Gudang Ketat**: Stok diperbarui dengan mencocokkan `warehouseId` asal dokumen secara eksplisit agar stok tidak tertukar antargudang.
   * Penambahan stok (`inventory_stocks` dan transaksi tipe `IN`) **HANYA** bertambah senilai total unit yang memiliki status Bagus (`Pass`) dari tahapan QC.
   * Barang yang rusak/gagal QC akan masuk ke dalam **Laporan Log Barang Cacat/Reject** dan dicatat sebagai transaksi khusus (`REJECT` / log audit penyesuaian) agar selisih antara barang dipesan, diterima, dan masuk stok riil dapat diaudit dengan jelas.

## Rincian Perubahan Database & Schema
- [x] **Phase 1**: Mematikan (disable) update stok otomatis saat status PR disetujui di dalam model.
- [ ] **Phase 2**: Membuat Schema & Modul untuk **Purchase Order** (`purchase_orders` & relasi *many-to-many* / referensi multi-PR).
- [ ] **Phase 3**: Membuat Schema & Modul untuk **Goods Receipt** (`goods_receipts` & `goods_receipt_details`).
- [ ] **Phase 4**: Membuat Schema & Modul untuk **Quality Control** (`quality_controls`).
- [ ] **Phase 5**: Modifikasi Model Transaksi / Inventory Upsert berdasarkan hasil akhir tabel `quality_controls`.

## Diagram Arsitektur & Relasi

- 1 PO bisa memuat banyak PR.
- 1 PO bisa dicicil ke dalam beberapa surat jalan Goods Receipt (Partial GR).
- 1 dokumen GR akan diinspeksi ke dalam 1 dokumen QC.
