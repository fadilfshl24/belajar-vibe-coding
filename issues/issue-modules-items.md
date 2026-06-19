# Issue: Refaktor Select-Option (Loader), Generator Barcode & Item Code, Detektor Scanner, dan Proteksi Duplikasi di Modul Items

## Deskripsi Masalah
Terdapat beberapa issue dan kebutuhan peningkatan (improvement) pada modul **Master Barang (Items)**:
1. **Gagal memilih Kategori & UOM**: Terjadi error saat memilih Kategori atau UOM karena ketidakselarasan tipe data (nullable di frontend vs not-null di backend/database) serta masalah state *controlled vs uncontrolled* pada komponen `<Select>` milik Shadcn/Radix UI.
2. **Kurangnya Loading State**: Komponen select-option yang mengambil data secara dinamis dari API belum menunjukkan indikator loading (*loader*) ketika sedang memproses data, sehingga membuat dropdown terasa kosong atau tidak responsif saat diklik.
3. **Kebutuhan Auto-Generation**: Kolom input **Kode Barang** (`code`) dan **Barcode** (`barcodeText`) perlu memiliki fitur generate otomatis dengan format spesifik untuk mempermudah operasional.
4. **Integrasi Scanner**: Dibutuhkan integrasi pendengar input barcode scanner secara global di halaman input barang dengan indikator status apakah pendengar scanner aktif.
5. **Keamanan Data**: Nilai Kode Barang dan Barcode tidak boleh diubah setelah data barang berhasil disimpan (*immutable on edit*), serta harus dilindungi dari duplikasi di sisi backend.

---

## Kebutuhan Sistem & Langkah Implementasi

### Bagian 1: Refaktor Select-Option & Loading State (Frontend)

Semua komponen input berbentuk select-option yang datanya bersumber dari API harus diberikan indikator loading dan status *disabled* saat data sedang di-fetch.

#### 1. Modifikasi Skema Validasi Frontend
Buka berkas [item.schema.ts](file:///D:/_Code/vibe-coding/frontend-wms-spp/src/features/items/validations/item.schema.ts) dan ubah validasi `categoryId` dan `uomId` agar wajib diisi (menghapus `.optional().nullable()`) untuk mencocokkan dengan skema database.
```typescript
// Sebelum:
// categoryId: z.string().uuid('Pilih kategori valid').optional().nullable(),
// uomId: z.string().uuid('Pilih UOM valid').optional().nullable(),

// Sesudah:
categoryId: z.string().uuid('Kategori wajib dipilih'),
uomId: z.string().uuid('UOM wajib dipilih'),
```

#### 2. Modifikasi Form Input Barang
Buka berkas [ItemSheetForm.tsx](file:///D:/_Code/vibe-coding/frontend-wms-spp/src/features/items/components/ItemSheetForm.tsx):
- Perbarui `defaultValues` pada `useForm` agar nilai default untuk `categoryId` dan `uomId` adalah empty string `""` (bukan `null`).
- Sesuaikan render `<Select>` untuk Kategori dan UOM:
  - Gunakan `value={field.value || ""}` untuk mencegah React memperingatkan tentang perubahan state dari uncontrolled ke controlled.
  - Tambahkan atribut `disabled={isLoadingCat}` pada Select Kategori dan `disabled={isLoadingUOM}` pada Select UOM.
  - Di dalam `<SelectTrigger>`, ganti teks placeholder secara dinamis:
    - Kategori: `{isLoadingCat ? 'Memuat Kategori...' : 'Pilih Kategori'}`
    - UOM: `{isLoadingUOM ? 'Memuat Satuan...' : 'Pilih Satuan'}`
- Sesuaikan render Select untuk Item Komponen Paket (`details.[index].childItemId`) agar memiliki loading state serupa saat data item single sedang di-load (`isLoadingItems`).

#### 3. Modifikasi Form Input Pengguna (Untuk Konsistensi)
Buka berkas [UserSheetForm.tsx](file:///D:/_Code/vibe-coding/frontend-wms-spp/src/features/users/components/UserSheetForm.tsx):
- Perbarui skema input dropdown Role agar menggunakan `value={field.value || ""}` dan tambahkan `disabled={isLoadingRoles}` serta placeholder `"Memuat role..."` jika data sedang diambil.

---

### Bagian 2: Generator Barcode & Kode Barang (Frontend)

Sediakan tombol **"Generate"** secara visual di sebelah kolom input Kode Barang dan Barcode pada [ItemSheetForm.tsx](file:///D:/_Code/vibe-coding/frontend-wms-spp/src/features/items/components/ItemSheetForm.tsx).

#### 1. Logika Pembuatan Kode Barang (Item Code)
Formula pembuatan Kode Barang:
- Diawali dengan string `"PRD-"`
- Diikuti oleh 6 digit angka acak (misal: `PRD-102938`).
- Pastikan kodenya menggunakan huruf besar (*uppercase*).

#### 2. Logika Pembuatan Barcode
Formula pembuatan Barcode:
- Total panjang **15 digit**.
- Diawali dengan angka `"49"`.
- Diikuti oleh 5 digit padding `"00000"`.
- Diikuti oleh 8 digit angka acak.
- Contoh fungsi pembantu:
```typescript
const generateBarcode = () => {
  const random8Digits = Math.floor(10000000 + Math.random() * 90000000).toString(); // 8 digit acak
  return `4900000${random8Digits}`; // 2 + 5 + 8 = 15 digit
};
```

#### 3. Integrasi ke Form
- Buat tombol di samping input Kode Barang dan Barcode dengan ikon menarik (misal: Lucide `Sparkles` atau `RefreshCw`).
- Saat diklik, panggil `setValue('code', generateItemCode())` atau `setValue('barcodeText', generateBarcode())` menggunakan API React Hook Form.
- Susun layout-nya agar input dan tombol berbaris horizontal (menggunakan Flexbox `flex gap-2`).

---

### Bagian 3: Detektor Scanner Barcode Global (Frontend)

Alat scanner fisik mengirimkan data ketukan keyboard dalam kecepatan tinggi diakhiri dengan tombol `Enter`. Kita perlu mendeteksinya secara global di modul input barang.

#### 1. Logika Deteksi Scanner Keyboard
Implementasikan `useEffect` di [ItemSheetForm.tsx](file:///D:/_Code/vibe-coding/frontend-wms-spp/src/features/items/components/ItemSheetForm.tsx) untuk menangkap event `keydown` global:
```typescript
useEffect(() => {
  if (!open) return;

  let buffer = '';
  let lastKeyTime = Date.now();

  const handleKeyDown = (e: KeyboardEvent) => {
    const currentTime = Date.now();
    
    // Jika interval antar karakter terlalu lambat (> 30ms), anggap ketikan manual biasa
    if (currentTime - lastKeyTime > 30) {
      buffer = '';
    }

    lastKeyTime = currentTime;

    // Deteksi tombol Enter sebagai penanda selesai memindai
    if (e.key === 'Enter') {
      if (buffer.length > 0) {
        e.preventDefault(); // Mencegah submit form tidak sengaja
        setValue('barcodeText', buffer);
        buffer = '';
      }
      return;
    }

    // Hanya ambil karakter teks (abaikan tombol kontrol seperti Shift, Alt, dll)
    if (e.key.length === 1) {
      buffer += e.key;
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => {
    window.removeEventListener('keydown', handleKeyDown);
  };
}, [open, setValue]);
```

#### 2. Indikator Status Scanner di UI
- Tampilkan badge informasi di bagian atas form input barang.
- Badge bertuliskan: **"Status Scanner: Aktif (Web Listener)"** dengan ikon lingkaran hijau berkedip/menyala (indikator visual sukses terpasang).

---

### Bagian 4: Pembatasan Perubahan Nilai pada Mode Edit (Frontend)

Ketika barang sedang dalam mode edit (`isEdit` bernilai `true`):
- Nonaktifkan input **Kode Barang** (`code`) dengan menambahkan atribut `disabled={isEdit}`.
- Nonaktifkan input **Barcode** (`barcodeText`) dengan menambahkan atribut `disabled={isEdit}`.
- Sembunyikan atau nonaktifkan tombol "Generate" untuk kedua field tersebut.
- Hal ini menjamin nilai kode dan barcode bersifat permanen (*immutable*) setelah barang berhasil dibuat.

---

### Bagian 5: Validasi Backend untuk Duplikasi Barcode & Kode Barang (Backend)

Perubahan ini dilakukan pada sisi server (repository backend) untuk menjamin tidak ada duplikasi data barang.

#### 1. Tambah Pencarian Barcode pada Model
Buka berkas [item.model.ts](file:///d:/_Code/vibe-coding/belajar-vibe-coding/src/modules/item/item.model.ts) dan tambahkan method pencarian berdasarkan teks barcode:
```typescript
static async findByBarcode(barcode: string): Promise<ItemRecord | undefined> {
  const result = await db
    .select()
    .from(items)
    .where(and(eq(items.barcodeText, barcode), isNull(items.deletedAt)))
    .limit(1);
  return result[0];
}
```

#### 2. Tambah Validasi pada Controller
Buka berkas [item.controller.ts](file:///d:/_Code/vibe-coding/belajar-vibe-coding/src/modules/item/item.controller.ts):
- Pada method `create`:
  - Lakukan pengecekan duplikasi barcode:
    ```typescript
    if (parsed.data.barcodeText) {
      const existingBarcode = await ItemModel.findByBarcode(parsed.data.barcodeText);
      if (existingBarcode) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Create data failed!", 400, "Barcode sudah terdaftar pada barang lain");
      }
    }
    ```
- Pada method `update`:
  - Lakukan pengecekan duplikasi barcode dengan membandingkan ID:
    ```typescript
    if (parsed.data.barcodeText) {
      const existingBarcode = await ItemModel.findByBarcode(parsed.data.barcodeText);
      if (existingBarcode && existingBarcode.id !== id) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Update data failed!", 400, "Barcode sudah terdaftar pada barang lain");
      }
    }
    ```

---

## Rencana Verifikasi

### 1. Verifikasi Select-Option & Loader
- Buka form Tambah Barang Baru.
- Simulasikan kondisi network lambat (via Chrome DevTools throttling) dan verifikasi bahwa dropdown Kategori, UOM, dan Item Komponen memunculkan pesan "Memuat..." dan berstatus disabled sebelum data terisi.
- Pilih salah satu kategori dan UOM, pastikan tidak terjadi error di konsol React dan nilai terpilih terikat dengan benar di form state.
- Coba kirimkan formulir kosong, verifikasi validasi Zod bekerja meminta Kategori dan UOM dipilih.

### 2. Verifikasi Generator & Immutability
- Klik tombol "Generate" Kode Barang. Verifikasi string diawali `PRD-` dengan total 10 karakter.
- Klik tombol "Generate" Barcode. Verifikasi angka berjumlah 15 digit dengan format `4900000XXXXXXXX`.
- Simpan barang tersebut, kemudian buka tombol Edit pada barang yang baru dibuat.
- Verifikasi kolom Kode Barang dan Barcode berstatus *disabled* dan tidak dapat diklik atau diedit.

### 3. Verifikasi Detektor Scanner
- Buka form Tambah Barang. Pastikan ada badge hijau bertuliskan **"Status Scanner: Aktif (Web Listener)"**.
- Fokuskan kursor di luar input barcode, lalu simulasikan pengetikan cepat (kecepatan tinggi) serangkaian angka dan tekan Enter.
- Verifikasi teks barcode tersebut langsung terisi otomatis pada kolom input Barcode.

### 4. Verifikasi Proteksi Duplikasi Backend
- Coba buat data barang baru menggunakan REST client dengan Kode Barang atau Barcode yang sama persis dengan data barang yang sudah ada.
- Pastikan API merespons dengan HTTP Status `400 Bad Request` dan menyertakan pesan error deskriptif yang sesuai.
