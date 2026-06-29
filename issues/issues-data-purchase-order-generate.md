# Perencanaan Pembuatan Modul Purchase Order (Frontend)

Dokumen ini berisi spesifikasi teknis untuk mengimplementasikan antarmuka modul **Purchase Order (PO)** pada aplikasi *frontend* menggunakan **TanStack Router**, **TanStack Query**, **React Hook Form**, **Zod**, dan **Axios**.

---

## 1. Konfigurasi Routing (TanStack Router)

Daftarkan *routes* baru untuk Purchase Order pada arsitektur *file-based routing* atau *route tree* di frontend:

*   `/purchase-orders` (List PO): Halaman utama untuk melihat daftar seluruh PO yang ada. Dilengkapi tabel dengan:
    *   *Search* pencarian global.
    *   *Filter* status PO (0: Draft, 1: Pending, 2: Approved, 3: Rejected, 4: Closed).
    *   *Pagination* (page, limit).
    *   *Sorting* (misal by CreatedAt DESC).
*   `/purchase-orders/create` (Create PO): Halaman form penuh (*full page*) untuk membuat PO baru. 
    *   Halaman ini harus menerima parameter opsional `purchaseRequestId` (jika pembuatan PO didasarkan pada dokumen *Purchase Request* yang disetujui).
    *   Jika parameter tersebut ada, lakukan *fetch* detail PR dan isi otomatis *details* barang, *vendorId*, dan *warehouseId*.
*   `/purchase-orders/:id` (Detail PO): Halaman untuk melihat detail data PO, termasuk informasi vendor, gudang tujuan, daftar item pesanan, dan status penerimaan barang.
*   `/purchase-orders/:id/receive` (Penerimaan Barang): Halaman form untuk mencatat kuantitas barang yang benar-benar diterima gudang (*receive goods*) untuk dicocokkan dengan kuantitas pesanan.

---

## 2. Autentikasi & Session (Auth.js & Axios)

Semua pemanggilan API ke backend (`http://localhost:3000`) wajib mengirimkan token autentikasi.

*   Ambil token aktif dari *session manager* **Auth.js**.
*   Sisipkan token ke dalam request header Axios secara otomatis menggunakan interceptor:
    ```typescript
    axiosInstance.interceptors.request.use((config) => {
      const token = getAuthJsToken(); // Ambil token dari session Auth.js
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
    ```

---

## 3. Custom Hooks API (TanStack Query)

Buat custom hooks untuk membungkus query dan mutasi data ke API backend sesuai dengan endpoint yang didefinisikan di `documentation/api-list.md`:

*   `usePurchaseOrders(params)`: `useQuery` ke `GET /api/purchase-orders` (mengirimkan params page, limit, search, status, dll).
*   `usePurchaseOrderDetail(id)`: `useQuery` ke `GET /api/purchase-orders/:id`.
*   `useCreatePurchaseOrder()`: `useMutation` ke `POST /api/purchase-orders`.
*   `useUpdatePurchaseOrder(id)`: `useMutation` ke `PUT /api/purchase-orders/:id`.
*   `useUpdatePOStatus(id)`: `useMutation` ke `PATCH /api/purchase-orders/:id/status` (untuk menyetujui, menolak, atau menutup PO).
*   `useReceiveGoods(id)`: `useMutation` ke `POST /api/purchase-orders/:id/receive` (mengirimkan data barang masuk).
*   `useDeletePurchaseOrder()`: `useMutation` ke `DELETE /api/purchase-orders/:id`.

---

## 4. Validasi Form (React Hook Form & Zod)

Gunakan **Zod** untuk mendefinisikan skema validasi form pembuatan PO baru agar data yang dikirimkan ke backend terjamin validasinya.

### Skema Validasi Zod
```typescript
import { z } from "zod";

const poDetailSchema = z.object({
  itemId: z.string().uuid("Item ID tidak valid"),
  quantity: z.number().int().min(1, "Kuantitas minimal 1 unit"),
  price: z.number().min(0, "Harga barang tidak boleh bernilai negatif"),
});

export const createPurchaseOrderSchema = z.object({
  purchaseRequestId: z.string().uuid("PR ID tidak valid").optional().nullable().or(z.literal("")),
  vendorId: z.string().uuid("Vendor wajib dipilih"),
  warehouseId: z.string().uuid("Gudang tujuan wajib dipilih"),
  orderDate: z.string().min(1, "Tanggal order wajib diisi"),
  expectedDeliveryDate: z.string().optional().or(z.literal("")),
  tax: z.number().min(0, "Pajak tidak boleh kurang dari 0").default(0),
  discount: z.number().min(0, "Diskon tidak boleh kurang dari 0").default(0),
  shippingFee: z.number().min(0, "Ongkos kirim tidak boleh kurang dari 0").default(0),
  description: z.string().optional().or(z.literal("")),
  details: z.array(poDetailSchema).min(1, "Minimal harus memasukkan 1 detail barang"),
});
```

*   **Penerapan di Form**: Gunakan `useForm` dari `react-hook-form` dipadukan dengan `zodResolver(createPurchaseOrderSchema)`.
*   Gunakan `useFieldArray` untuk mengelola penambahan, perubahan kuantitas, harga, maupun penghapusan item detail secara dinamis dan interaktif di UI.

---

## 5. Proteksi Keamanan & Permission Guard

Batasi akses menu dan tombol aksi di antarmuka pengguna berdasarkan perizinan menu `purchase_order` (sesuai matriks peran pengguna).

*   Gunakan utilitas guard terpusat di frontend (contoh: hook `usePermissions("purchase_order")`) untuk mendapatkan status perizinan.
*   **Logika Guard**:
    *   **Akses Halaman**: Jika `canView` bernilai `false`, arahkan pengguna keluar dari `/purchase-orders` (tampilkan halaman Unauthorized).
    *   **Tombol Buat PO**: Sembunyikan/Nonaktifkan tombol "Buat Purchase Order" jika `canCreate` bernilai `false`.
    *   **Tombol Edit/Terima**: Sembunyikan tombol "Edit PO", "Ubah Status", dan "Terima Barang" jika `canUpdate` bernilai `false`.
    *   **Tombol Hapus**: Sembunyikan tombol "Hapus PO" jika `canDelete` bernilai `false`.

---

## 6. Integrasi Reporting Activity Logs

Setiap kali pengguna berhasil melakukan aksi mutasi data pada modul PO, pastikan sistem mencatat aktivitas tersebut ke dalam sistem logs backend.

*   Mekanisme pencatatan log otomatis dilakukan oleh *backend middleware* setiap kali ada aktivitas masuk ke endpoint `/api/purchase-orders`.
*   Untuk di sisi frontend, pastikan untuk menangani pengiriman data header yang memadai (seperti `user-agent` atau IP jika diwajibkan) demi pelaporan logs yang akurat.
