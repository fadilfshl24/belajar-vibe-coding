# Implementation Plan: Modul Items - Select-Option Loader, Barcode & Item Code Auto-Generation, Scanner Detektor, & Proteksi Duplikasi (Issue #17)

## Goal
Menyelesaikan seluruh kebutuhan perbaikan pada modul Master Barang (Items) sesuai petunjuk pada [issue-modules-items.md](file:///d:/_Code/vibe-coding/belajar-vibe-coding/issues/issue-modules-items.md).

## Proposed Changes

### 1. Database Schema
Tidak ada perubahan pada schema database Drizzle, karena kolom `code` dan `barcode_text` pada tabel `items` sudah dikonfigurasi dengan constraint `unique()`.

---

### 2. Backend Layer

#### [MODIFY] [item.model.ts](file:///d:/_Code/vibe-coding/belajar-vibe-coding/src/modules/item/item.model.ts)
- Tambahkan method static `findByBarcode(barcode: string)` untuk mencari barang berdasarkan barcode.
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

#### [MODIFY] [item.controller.ts](file:///d:/_Code/vibe-coding/belajar-vibe-coding/src/modules/item/item.controller.ts)
- Pada method `create`, tambahkan pengecekan keunikan barcode:
```typescript
if (parsed.data.barcodeText) {
  const existingBarcode = await ItemModel.findByBarcode(parsed.data.barcodeText);
  if (existingBarcode) {
    ctx.set.status = 400;
    return failedResponse(correlationId, "Create data failed!", 400, "Barcode sudah terdaftar pada barang lain");
  }
}
```
- Pada method `update`, tambahkan pengecekan keunikan barcode dengan pengecualian ID barang saat ini:
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

### 3. Frontend Layer

#### [MODIFY] [item.schema.ts](file:///D:/_Code/vibe-coding/frontend-wms-spp/src/features/items/validations/item.schema.ts)
- Ubah validasi Zod agar `categoryId` dan `uomId` menjadi wajib diisi:
```typescript
categoryId: z.string().uuid("Kategori wajib dipilih"),
uomId: z.string().uuid("Satuan (UOM) wajib dipilih"),
```

#### [MODIFY] [ItemSheetForm.tsx](file:///D:/_Code/vibe-coding/frontend-wms-spp/src/features/items/components/ItemSheetForm.tsx)
- **Select-Option & Loader**:
  - Ganti `categoryId` dan `uomId` di bagian `defaultValues` awal/reset menjadi empty string `""`.
  - Pasang `value={field.value || ""}` pada select Kategori, UOM, dan Detail Paket Item.
  - Tambahkan prop `disabled` pada select-select tersebut selama data loading (`isLoadingCat`, `isLoadingUOM`, `isLoadingItems`).
- **Generator Kode Barang & Barcode**:
  - Tambahkan fungsi helper untuk men-generate kode barang (`PRD-` + 6 digit acak) dan barcode (15 digit: `4900000` + 8 digit acak).
  - Tampilkan tombol "Generate" di sebelah input Kode Barang dan Barcode secara horizontal (menggunakan flex layout). Sembunyikan atau nonaktifkan tombol jika dalam mode edit (`isEdit === true`).
- **Pembatasan Mode Edit**:
  - Nonaktifkan input `code` dan `barcodeText` jika `isEdit` bernilai `true`.
- **Detektor Scanner Barcode**:
  - Implementasikan detektor keypress global menggunakan `useEffect`. Kumpulkan input keystroke berkecepatan tinggi (< 30ms per karakter) ke buffer. Ketika tombol `Enter` ditekan, cegah submit bawaan form, isi field `barcodeText` dengan isi buffer, lalu kosongkan buffer.
  - Tampilkan indikator status scanner di bagian atas form: Badge berwarna hijau bertuliskan `"Status Scanner: Aktif (Web Listener)"` jika listener berhasil dipasang.

#### [MODIFY] [UserSheetForm.tsx](file:///D:/_Code/vibe-coding/frontend-wms-spp/src/features/users/components/UserSheetForm.tsx)
- **Select-Option & Loader**:
  - Ubah `roleId` di bagian default values menjadi `""`.
  - Gunakan `value={field.value || ""}` pada dropdown Select Role.
  - Tambahkan `disabled={isLoadingRoles}` pada dropdown Select Role.

---

## Verification Plan

### Automated Tests
- Jalankan pemeriksaan linter:
  - Backend: `bun run lint` (jika ada)
  - Frontend: `npm run lint`

### Manual Verification
1. **Dropdown Loader**: Pastikan dropdown menampilkan teks "Memuat..." dan ter-disable saat pertama kali loading.
2. **Auto-Generate**: Klik tombol "Generate" pada input Kode Barang dan Barcode, lalu verifikasi kesesuaian format (`PRD-XXXXXX` dan `4900000XXXXXXXX`).
3. **Lock on Edit**: Buka salah satu barang untuk diedit, pastikan input Kode Barang dan Barcode dalam keadaan tidak dapat diedit (*disabled*).
4. **Scanner Detektor**: Lakukan ketik cepat angka (emulasi scanner) dan tekan Enter. Verifikasi kolom barcode terisi otomatis dan form tidak men-submit.
5. **Backend Unique Check**: Coba masukkan Kode Barang atau Barcode yang duplikat lewat API/Client REST dan pastikan respons diblokir dengan status `400 Bad Request`.
