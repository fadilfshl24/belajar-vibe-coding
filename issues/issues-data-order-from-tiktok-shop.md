# Perencanaan Integrasi Tarik Data Pesanan E-Commerce (TikTok Shop, Shopee, Lazada)

Dokumen ini berisi spesifikasi teknis untuk mengimplementasikan *background job* / *console app* dan *webhook receiver* yang bertugas menarik data pesanan baru/pending dari berbagai platform e-commerce (TikTok Shop dengan 3 akun berbeda, Shopee, Lazada, dll) ke dalam database internal WMS. 

Sistem ini bersifat **sinkronisasi satu arah (one-way sync)** untuk keperluan validasi internal gudang dan pencocokan status pengepakan barang (tidak ada proses update status kembali ke pihak e-commerce).

---

## 1. Skema Database (Drizzle ORM)

Kita akan membuat 3 tabel baru di backend untuk memetakan data pesanan dari platform e-commerce ke sistem lokal.

### A. Tabel `order_platforms` (Header Pesanan)
```typescript
import { pgTable, uuid, varchar, decimal, boolean, timestamp, text } from "drizzle-orm/pg-core";
import { auditColumns } from "../../core/db/audit";

export const orderPlatforms = pgTable("order_platforms", {
  id: uuid("id").primaryKey().defaultRandom(),
  platformOrderId: varchar("platform_order_id", { length: 100 }).notNull().unique(), // ID pesanan e-commerce (unik)
  platformId: varchar("platform_id", { length: 50 }).notNull(), // Asal platform: 'tiktok', 'shopee', 'lazada'
  shopId: varchar("shop_id", { length: 100 }).notNull(), // Untuk membedakan 3 akun TikTok / e-commerce lain
  status: varchar("status", { length: 50 }).notNull().default("pending"), // Status internal WMS: 'pending', 'dalam proses', 'selesai'
  platformStatus: varchar("platform_status", { length: 50 }).notNull(), // Status asli di e-commerce
  totalAmount: decimal("total_amount", { precision: 18, scale: 2 }).notNull().default("0"),
  shippingProvider: varchar("shipping_provider", { length: 100 }),
  trackingNumber: varchar("tracking_number", { length: 100 }),
  buyerMessage: text("buyer_message"),
  shippingType: varchar("shipping_type", { length: 50 }),
  rtsSlaTime: timestamp("rts_sla_time"), // SLA Ready to Ship
  isCod: boolean("is_cod").notNull().default(false),
  cancelReason: text("cancel_reason"),
  createTime: timestamp("create_time").notNull(), // Waktu dibuat di e-commerce
  updateTime: timestamp("update_time").notNull(), // Waktu diupdate di e-commerce
  proofOfDelivery: varchar("proof_of_delivery", { length: 255 }), // URL/Path gambar bukti pengiriman
  ...auditColumns,
});
```

### B. Tabel `order_platform_details` (Detail Item Pesanan)
```typescript
export const orderPlatformDetails = pgTable("order_platform_details", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderPlatformId: uuid("order_platform_id")
    .notNull()
    .references(() => orderPlatforms.id, { onDelete: "cascade" }),
  productId: varchar("product_id", { length: 100 }).notNull(),
  productName: varchar("product_name", { length: 255 }).notNull(),
  sellerSku: varchar("seller_sku", { length: 100 }),
  salePrice: decimal("sale_price", { precision: 18, scale: 2 }).notNull().default("0"),
  qty: integer("qty").notNull().default(1),
  skuId: varchar("sku_id", { length: 100 }),
  ...auditColumns,
});
```

### C. Tabel `recipient_platforms` (Informasi Penerima)
```typescript
export const recipientPlatforms = pgTable("recipient_platforms", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderPlatformId: uuid("order_platform_id")
    .notNull()
    .references(() => orderPlatforms.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  address: text("address").notNull(),
  regionCode: varchar("region_code", { length: 20 }),
  postalCode: varchar("postal_code", { length: 20 }),
  ...auditColumns,
});
```

---

## 2. Strategi Validasi Data & De-duplikasi

Untuk menghindari terjadinya data ganda atau duplikasi saat proses penarikan dari background job maupun webhook:

1.  **Unique Constraint & Upsert**:
    *   Tabel `order_platforms` memiliki unique constraint pada kolom `platform_order_id`.
    *   Setiap kali data ditarik, lakukan operasi **Upsert** (Update or Insert) berdasarkan `platform_order_id`.
    *   Jika pesanan belum terdaftar di database, buat record baru.
    *   Jika pesanan sudah ada, perbarui informasi status dari e-commerce (`platformStatus`), `trackingNumber`, dan `updateTime` tanpa memengaruhi status lokal WMS (`status`) yang sedang berjalan, kecuali status lokal sudah diatur secara manual.
2.  **Penanganan Data Tidak Valid (Queueing & Skipping)**:
    *   Jika data yang diterima tidak memiliki field wajib seperti `platform_order_id` atau `totalAmount` bernilai tidak valid, sistem harus me-log error tersebut.
    *   Opsional: Simpan data tidak valid tersebut ke dalam tabel log/antrean gagal (`failed_order_queues`) agar tidak menyumbat background job utama dan dapat divalidasi ulang oleh tim IT.

---

## 3. Struktur Mapper Multi E-Commerce

Gunakan modul *mapper* terstandar dengan interface TypeScript untuk mengonversi data masukan dari berbagai struktur API e-commerce ke format database lokal.

### Interface Dasar Mapper
```typescript
export interface IPlatformOrderMapper {
  mapOrder(raw: any, shopId: string): any;
  mapDetails(raw: any): any[];
  mapRecipient(raw: any): any;
}
```

### A. TikTok Shop Mapper (`TiktokOrderMapper.ts`)
*   **Waktu Pembuatan**: Konversi Unix Epoch (dalam detik) dari `create_time` menjadi objek `Date` -> `new Date(raw.create_time * 1000)`.
*   **Total Nilai**: Ambil dari `payment.total_amount` dan konversi menjadi angka/decimal.
*   **Daftar Item**: Petakan dari array `line_items` (`product_id`, `product_name`, `seller_sku`, `sale_price`, `qty`, `sku_id`).
*   **Alamat Penerima**: Petakan dari objek `recipient_address` (`name`, `phone_number`, `full_address`, `region_code`, `postal_code`).
*   **Nilai Default**:
    *   `buyer_message` -> Default: `""` (jika null/undefined).
    *   `is_cod` -> Default: `false` (jika tidak ada data).

### B. Shopee Mapper (`ShopeeOrderMapper.ts`)
*   **Waktu Pembuatan**: Konversi Unix Epoch `create_time` (detik) ke Date.
*   **Total Nilai**: Petakan dari field `total_amount` e-commerce.
*   **Daftar Item**: Iterasi dari array `item_list` (`item_id`, `item_name`, `model_sku`, `model_quantity`, `model_discounted_price`).
*   **Alamat Penerima**: Ambil dari `recipient_address` (`name`, `phone`, `full_address`, `zipcode`).

### C. Lazada Mapper (`LazadaOrderMapper.ts`)
*   **Waktu Pembuatan**: Parsing string tanggal ISO `created_at` (contoh: `"2026-06-29T13:00:00Z"`) menjadi Date -> `new Date(raw.created_at)`.
*   **Total Nilai**: Ambil dari `price` pesanan.
*   **Daftar Item**: Iterasi dari array `items` (`product_id`, `name`, `sku`, `paid_price`, `qty`).
*   **Alamat Penerima**: Petakan dari `address_billing` atau `address_shipping`.

---

## 4. Alur Integrasi Webhook & Background Job (Console App)

1.  **Webhook Receiver Route (`/api/webhooks/:platform`)**:
    *   Elysia API akan meluncurkan route webhook yang bisa dilisten oleh e-commerce.
    *   Setiap kali ada payload masuk, tentukan platform berdasarkan parameter url (misal `/api/webhooks/tiktok`).
    *   Gunakan mapper yang sesuai untuk merapikan payload lalu panggil fungsi upsert ke database.
2.  **Cron Job Sync (Background Job)**:
    *   Gunakan scheduler Bun (`Bun.cron` atau modul sejenis) yang berjalan setiap X menit sekali untuk melakukan polling data pesanan terbaru (berstatus pending/unpaid) dari API e-commerce sebagai fallback bila ada webhook yang gagal terkirim.

---

## 5. Antarmuka Pengguna di WMS (Frontend)

1.  **Daftar Pesanan E-Commerce**:
    *   Halaman tabel responsif yang menampilkan pesanan yang ditarik dari platform.
    *   Menyediakan tab atau filter berdasarkan `shopId` untuk memilah 3 akun TikTok Shop atau platform lainnya.
    *   Kolom status lokal ditampilkan dengan jelas: `Pending`, `Dalam Proses`, atau `Selesai`.
2.  **Form/Page Upload Bukti Pengiriman**:
    *   Untuk pesanan berstatus `Pending` atau `Dalam Proses`, sediakan tombol aksi untuk mengunggah bukti foto resi/pengiriman.
    *   Form input berupa halaman baru (bukan modal) agar leluasa, yang meminta pengunggahan berkas gambar (`proof_of_delivery`) dan konfirmasi pengisian nomor resi (`tracking_number`).
3.  **Pengecekan Manual**:
    *   Staff gudang dapat memverifikasi barang e-commerce satu per satu dari tabel detail item (`order_platform_details`) sebelum mengubah status internalnya menjadi `Selesai`.
