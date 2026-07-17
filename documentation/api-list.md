# Dokumentasi API WMS (Warehouse Management System)

Dokumentasi ini dibuat untuk digunakan oleh Frontend Developer sebagai acuan dalam pembuatan antarmuka (UI) aplikasi. Seluruh endpoint menggunakan format request/response berbasis JSON dengan sistem autentikasi berbasis Sesi (Session Bearer Token).

---

## 1. Informasi Umum & Standardisasi

### Base URL

```text
http://localhost:3000
```

### Request Headers

Untuk semua request (terutama yang bertipe **Protected**), frontend wajib mengirimkan header berikut:

* `Content-Type: application/json`
* `Authorization: Bearer <session_token>` (Wajib untuk endpoint Protected)
* `X-Correlation-Id: <uuid>` (Opsional, digunakan untuk melacak request/debugging. Jika tidak dikirim, server akan membuatnya secara otomatis)

---

## 2. Format Response Standar

Server mengembalikan struktur response yang konsisten untuk semua endpoint, baik sukses maupun error.

### A. Response Sukses (Tanpa Pagination)

Digunakan untuk aksi Create, Update, Delete, Detail, atau List sederhana.

```json
{
  "meta": {
    "correlationId": "8e196ea1-6e5a-498d-9beb-7a6942486bf6",
    "status": true,
    "code": 200,
    "message": "Data found!",
    "exceptionMessage": ""
  },
  "data": {
    "record": {
      "id": "e44df2fb-9a1b-4f7f-82a1-6a0cf2ee9922",
      "name": "Admin Gudang Utama",
      "createdAt": "2026-06-19T00:00:00.000Z"
    }
  }
}
```

*Catatan: Pada aksi Delete atau Logout, properti `data` akan bernilai `null`.*

### B. Response Sukses (Dengan Pagination / List)

Digunakan saat mengambil daftar data (GET list).

```json
{
  "meta": {
    "correlationId": "deb1df4e-1e5c-4e63-9750-3dd686bd8571",
    "status": true,
    "code": 200,
    "message": "Data found!",
    "exceptionMessage": "",
    "pagination": {
      "page": 1,
      "limit": 10,
      "totalRecord": 45,
      "totalPage": 5,
      "nextPage": true,
      "previousPage": false,
      "nextPageURL": "http://localhost:3000/api/warehouses?page=2&limit=10",
      "previousPageURL": "",
      "filterColumn": "",
      "searchTerm": "",
      "orderBy": "{'CreatedAt':'DESC'}"
    }
  },
  "data": {
    "records": [
      {
        "id": "d6ee4177-4d5f-42d1-80d9-6c0d175f5897",
        "code": "GDG01",
        "name": "Gudang Jakarta Utama"
      }
    ]
  }
}
```

### C. Response Gagal / Error (HTTP 400, 401, 403, 404, 500)

Jika terjadi kesalahan input, token kadaluarsa, atau internal server error, format response adalah:

```json
{
  "meta": {
    "correlationId": "8e196ea1-6e5a-498d-9beb-7a6942486bf6",
    "status": false,
    "code": 400,
    "message": "Create data failed!",
    "exceptionMessage": "Email already registered"
  },
  "data": null
}
```

---

## 3. Parameter Query Standard (Untuk GET List)

Hampir seluruh endpoint GET list menerima parameter query berikut untuk filtering dan pagination:

* `page` (number, default: `1`): Halaman data yang ingin diambil.
* `limit` (number, default: `10`): Jumlah data per halaman. Gunakan nilai `1000` untuk mengambil semua data sekaligus tanpa pagination.
* `searchTerm` (string, opsional): Kata kunci pencarian global.
* `filterColumn` (string, opsional): Kolom tertentu untuk membatasi pencarian.
* `orderBy` (string, default: `"{'CreatedAt':'DESC'}"`): Pengurutan data dalam bentuk stringified object.

---

## 4. Daftar Endpoint API Lengkap

### 4.1 Modul: Autentikasi (`/api/auth`)

#### 1. Login Lokal

* **Method**: `POST`
* **Path**: `/api/auth/login`
* **Auth Required**: No
* **Request Payload**:

  ```json
  {
    "email": "admin@example.com",
    "password": "securepassword123"
  }
  ```

* **Response Sukses (200)**:

  ```json
  {
    "meta": {
      "correlationId": "deb1df4e-1e5c-4e63-9750-3dd686bd8571",
      "status": true,
      "code": 200,
      "message": "Data found!",
      "exceptionMessage": ""
    },
    "data": {
      "record": {
        "accessToken": "d6ee4177-4d5f-42d1-80d9-6c0d175f5897",
        "refreshToken": "d6ee4177-4d5f-42d1-80d9-6c0d175f5897",
        "tokenType": "Bearer",
        "expiresIn": "7d"
      }
    }
  }
  ```

#### 2. Refresh Token

* **Method**: `POST`
* **Path**: `/api/auth/refresh-token`
* **Auth Required**: No
* **Request Payload**:

  ```json
  {
    "refreshToken": "d6ee4177-4d5f-42d1-80d9-6c0d175f5897"
  }
  ```

* **Response Sukses (200)**:

  ```json
  {
    "meta": { ... },
    "data": {
      "record": {
        "accessToken": "d6ee4177-4d5f-42d1-80d9-6c0d175f5897",
        "tokenType": "Bearer",
        "expiresIn": "7d"
      }
    }
  }
  ```

#### 3. Logout

* **Method**: `POST`
* **Path**: `/api/auth/logout`
* **Auth Required**: Yes
* **Response Sukses (200)**:

  ```json
  {
    "meta": {
      "status": true,
      "code": 200,
      "message": "Data has been deleted",
      "exceptionMessage": ""
    },
    "data": null
  }
  ```

#### 4. OAuth Redirect (Google, Facebook, GitHub, GitLab)

* **Method**: `GET`
* **Path**: `/api/auth/oauth/:provider`
* **Auth Required**: No
* **Description**: Mengarahkan browser user langsung ke halaman login provider yang dipilih (`google`, `facebook`, `github`, atau `gitlab`).

#### 5. OAuth Callback

* **Method**: `GET`
* **Path**: `/api/auth/oauth/:provider/callback`
* **Auth Required**: No
* **Query Params**: `code` (disediakan otomatis setelah redirect dari OAuth provider)
* **Response Sukses (200)**:

  ```json
  {
    "meta": {
      "status": true,
      "code": 200,
      "message": "OAuth Authentication Successful!",
      "exceptionMessage": ""
    },
    "data": {
      "record": {
        "accessToken": "2ed9d2be-04d0-4d06-9cba-3e6dfef2ee9f",
        "refreshToken": "2ed9d2be-04d0-4d06-9cba-3e6dfef2ee9f",
        "tokenType": "Bearer",
        "expiresIn": "7d"
      }
    }
  }
  ```

---

### 4.2 Modul: User Management (`/api/users`)

#### 1. List Users

* **Method**: `GET`
* **Path**: `/api/users`
* **Auth Required**: Yes
* **Response Sukses (200)**:

  ```json
  {
    "meta": { ... , "pagination": { ... } },
    "data": {
      "records": [
        {
          "id": "e44df2fb-9a1b-4f7f-82a1-6a0cf2ee9922",
          "name": "Jane Doe",
          "email": "jane@example.com",
          "status": 1,
          "createdAt": "2026-06-19T00:00:00.000Z",
          "updatedAt": null
        }
      ]
    }
  }
  ```

#### 2. Detail User

* **Method**: `GET`
* **Path**: `/api/users/:id`
* **Auth Required**: Yes
* **Response Sukses (200)**:

  ```json
  {
    "meta": { ... },
    "data": {
      "record": {
        "id": "e44df2fb-9a1b-4f7f-82a1-6a0cf2ee9922",
        "name": "Jane Doe",
        "email": "jane@example.com",
        "status": 1,
        "createdAt": "2026-06-19T00:00:00.000Z",
        "updatedAt": null
      }
    }
  }
  ```

#### 3. Register User Baru

* **Method**: `POST`
* **Path**: `/api/users`
* **Auth Required**: Yes
* **Request Payload**:

  ```json
  {
    "name": "John Doe",
    "email": "john.doe@example.com",
    "password": "strongpassword123"
  }
  ```

* **Response Sukses (200)**:

  ```json
  {
    "meta": {
      "status": true,
      "code": 200,
      "message": "Data has been created"
    },
    "data": null
  }
  ```

#### 4. Update Status Aktif User

* **Method**: `PATCH`
* **Path**: `/api/users/:id/status`
* **Auth Required**: Yes
* **Request Payload**:

  ```json
  {
    "status": 1
  }
  ```

  *(Status: `1` untuk Aktif, `0` untuk Nonaktif)*
* **Response Sukses (200)**:

  ```json
  {
    "meta": { "message": "Data has been updated" },
    "data": null
  }
  ```

#### 5. Delete User (Soft Delete)

* **Method**: `DELETE`
* **Path**: `/api/users/:id`
* **Auth Required**: Yes
* **Response Sukses (200)**:

  ```json
  {
    "meta": { "message": "Data has been deleted" },
    "data": null
  }
  ```

---

### 4.3 Modul: Role Management (`/api/roles`)

*Catatan: Penamaan `name` pada role wajib menggunakan huruf kecil dan underscore (regex: `/^[a-z_]+$/`), contoh: `warehouse_head`.*

#### 1. List Roles

* **Method**: `GET`
* **Path**: `/api/roles`
* **Auth Required**: Yes

#### 2. Detail Role

* **Method**: `GET`
* **Path**: `/api/roles/:id`
* **Auth Required**: Yes

#### 3. Create Role

* **Method**: `POST`
* **Path**: `/api/roles`
* **Auth Required**: Yes
* **Request Payload**:

  ```json
  {
    "name": "warehouse_head",
    "description": "Kepala Gudang Regional"
  }
  ```

* **Response Sukses (200)**:

  ```json
  {
    "meta": { "message": "Data has been created" },
    "data": {
      "record": {
        "id": "b18ca772-2f3b-4890-a7d5-d0ff081bc12f",
        "name": "warehouse_head",
        "description": "Kepala Gudang Regional",
        "createdAt": "2026-06-19T00:00:00.000Z"
      }
    }
  }
  ```

#### 4. Update Role

* **Method**: `PUT`
* **Path**: `/api/roles/:id`
* **Auth Required**: Yes
* **Request Payload**:

  ```json
  {
    "name": "warehouse_leader",
    "description": "Pemimpin Gudang Regional"
  }
  ```

#### 5. Delete Role (Soft Delete)

* **Method**: `DELETE`
* **Path**: `/api/roles/:id`
* **Auth Required**: Yes

---

### 4.4 Modul: Menu Management (`/api/menus`)

*Catatan: Kolom `code` wajib menggunakan huruf kecil dan underscore (regex: `/^[a-z_]+$/`), dan `path` harus diawali dengan `/`.*

#### 1. List Menus

* **Method**: `GET`
* **Path**: `/api/menus`
* **Auth Required**: Yes

#### 2. Create Menu

* **Method**: `POST`
* **Path**: `/api/menus`
* **Auth Required**: Yes
* **Request Payload**:

  ```json
  {
    "name": "Master Data",
    "code": "master_data",
    "path": "/master-data"
  }
  ```

#### 3. Update Menu

* **Method**: `PUT`
* **Path**: `/api/menus/:id`
* **Auth Required**: Yes

#### 4. Delete Menu

* **Method**: `DELETE`
* **Path**: `/api/menus/:id`
* **Auth Required**: Yes

---

### 4.5 Modul: Permission Matrix (`/api/role-permissions`)

Modul ini mengelola matriks perizinan akses menu untuk setiap role (View, Create, Update, Delete).

#### 1. Get Permission Matrix

* **Method**: `GET`
* **Path**: `/api/role-permissions`
* **Auth Required**: Yes
* **Response Sukses (200)**:

  ```json
  {
    "meta": { ... },
    "data": {
      "records": [
        {
          "id": "f5f5e4e2-2a2b-3c3c-4d4d-5e5e6f6f7g7g",
          "roleId": "b18ca772-2f3b-4890-a7d5-d0ff081bc12f",
          "roleName": "warehouse_head",
          "menuId": "c6c6b5b5-1a1a-2b2b-3c3c-4d4d5e5e6f6f",
          "menuName": "Master Data",
          "menuCode": "master_data",
          "canView": true,
          "canCreate": false,
          "canUpdate": false,
          "canDelete": false
        }
      ]
    }
  }
  ```

#### 2. Bulk Update Permissions

* **Method**: `PUT`
* **Path**: `/api/role-permissions`
* **Auth Required**: Yes (Superadmin Only)
* **Request Payload**:

  ```json
  {
    "permissions": [
      {
        "roleId": "b18ca772-2f3b-4890-a7d5-d0ff081bc12f",
        "menuId": "c6c6b5b5-1a1a-2b2b-3c3c-4d4d5e5e6f6f",
        "canView": true,
        "canCreate": true,
        "canUpdate": true,
        "canDelete": false
      }
    ]
  }
  ```

* **Response Sukses (200)**:

  ```json
  {
    "meta": { "message": "Permissions have been updated" },
    "data": null
  }
  ```

---

### 4.6 Modul: Activity Log (`/api/activity-logs`)

#### 1. List Activity Logs (Monitoring)

* **Method**: `GET`
* **Path**: `/api/activity-logs`
* **Auth Required**: Yes
* **Query Params Tambahan**:
  * `userId` (UUID, opsional): Filter berdasarkan pembuat aksi.
  * `action` (string, opsional): Filter aksi tertentu (misal: `LOGIN`, `REGISTER`, `CREATE_DATA`).
  * `startDate` (ISO-Date, opsional): Batas awal log dibuat.
  * `endDate` (ISO-Date, opsional): Batas akhir log dibuat.
* **Response Sukses (200)**:

  ```json
  {
    "meta": { ... , "pagination": { ... } },
    "data": {
      "records": [
        {
          "id": "99f36bd1-3d23-42eb-8280-5a3ab9c2ee03",
          "userId": "e44df2fb-9a1b-4f7f-82a1-6a0cf2ee9922",
          "userEmail": "jane@example.com",
          "action": "LOGIN",
          "description": "User Jane Doe berhasil masuk ke sistem",
          "ipAddress": "192.168.1.10",
          "userAgent": "Mozilla/5.0 ...",
          "createdAt": "2026-06-19T07:22:00.000Z"
        }
      ]
    }
  }
  ```

---

### 4.7 Modul: Warehouse Management (`/api/warehouses`)

#### 1. List Warehouses

* **Method**: `GET`
* **Path**: `/api/warehouses`
* **Auth Required**: Yes

#### 2. Detail Warehouse

* **Method**: `GET`
* **Path**: `/api/warehouses/:id`
* **Auth Required**: Yes

#### 3. Create Warehouse

* **Method**: `POST`
* **Path**: `/api/warehouses`
* **Auth Required**: Yes
* **Request Payload**:

  ```json
  {
    "code": "GDG_JKT_01",
    "name": "Gudang Jakarta Pusat",
    "description": "Gudang penyimpanan utama wilayah DKI Jakarta",
    "address": "Jl. Gajah Mada No. 12",
    "province": "DKI Jakarta",
    "cityRegency": "Jakarta Pusat",
    "district": "Gambir",
    "village": "Petojo Utara",
    "zipCode": "10130",
    "latitude": -6.168482,
    "longitude": 106.814321,
    "isActive": true
  }
  ```

* **Response Sukses (200)**:

  ```json
  {
    "meta": { "message": "Data has been created" },
    "data": {
      "record": {
        "id": "76326c59-b1d8-4f81-8078-d7b1b3691cc4",
        "code": "GDG_JKT_01",
        "name": "Gudang Jakarta Pusat",
        ... ,
        "createdAt": "2026-06-19T00:00:00.000Z"
      }
    }
  }
  ```

#### 4. Update Warehouse

* **Method**: `PUT`
* **Path**: `/api/warehouses/:id`
* **Auth Required**: Yes
* **Request Payload**: (Kirim properti yang ingin diubah saja - partial update)

  ```json
  {
    "name": "Gudang Jakarta Pusat Barat",
    "isActive": false
  }
  ```

#### 5. Delete Warehouse

* **Method**: `DELETE`
* **Path**: `/api/warehouses/:id`
* **Auth Required**: Yes

#### 6. Get Warehouse Heads (Daftar Kepala Gudang tertentu)

* **Method**: `GET`
* **Path**: `/api/warehouses/:id/heads`
* **Auth Required**: Yes
* **Response Sukses (200)**:

  ```json
  {
    "meta": { ... },
    "data": {
      "records": [
        {
          "id": "e4e2a222-2a2b-3c3c-4d4d-5e5e6f6f7g7g",
          "warehouseId": "76326c59-b1d8-4f81-8078-d7b1b3691cc4",
          "userId": "e44df2fb-9a1b-4f7f-82a1-6a0cf2ee9922",
          "userName": "Jane Doe",
          "isActive": true,
          "description": "Kepala Gudang Utama JKT"
        }
      ]
    }
  }
  ```

#### 7. Assign Warehouse Head (Menunjuk Kepala Gudang)

* **Method**: `POST`
* **Path**: `/api/warehouses/:id/heads`
* **Auth Required**: Yes
* **Request Payload**:

  ```json
  {
    "userId": "e44df2fb-9a1b-4f7f-82a1-6a0cf2ee9922",
    "description": "Kepala Gudang Utama JKT"
  }
  ```

#### 8. Unassign Warehouse Head (Melepas Kepala Gudang)

* **Method**: `DELETE`
* **Path**: `/api/warehouses/heads/:headId`
* **Auth Required**: Yes
  *(Catatan: `:headId` adalah ID relasi pivot warehouse_head, bukan ID user)*

---

### 4.8 Modul: Category Management (`/api/categories`)

#### 1. List Categories

* **Method**: `GET`
* **Path**: `/api/categories`
* **Auth Required**: Yes

#### 2. Create Category

* **Method**: `POST`
* **Path**: `/api/categories`
* **Auth Required**: Yes
* **Request Payload**:

  ```json
  {
    "code": "ELEKTRONIK",
    "name": "Barang Elektronik",
    "description": "Kategori untuk segala jenis barang elektronik",
    "isActive": true
  }
  ```

#### 3. Update Category

* **Method**: `PUT`
* **Path**: `/api/categories/:id`
* **Auth Required**: Yes

#### 4. Delete Category

* **Method**: `DELETE`
* **Path**: `/api/categories/:id`
* **Auth Required**: Yes

---

### 4.9 Modul: UOM Management (`/api/uoms`)

#### 1. List UOM

* **Method**: `GET`
* **Path**: `/api/uoms`
* **Auth Required**: Yes

#### 2. Create UOM

* **Method**: `POST`
* **Path**: `/api/uoms`
* **Auth Required**: Yes
* **Request Payload**:

  ```json
  {
    "code": "PCS",
    "name": "Pieces",
    "description": "Satuan barang satuan / buah",
    "isActive": true
  }
  ```

#### 3. Update UOM

* **Method**: `PUT`
* **Path**: `/api/uoms/:id`
* **Auth Required**: Yes

#### 4. Delete UOM

* **Method**: `DELETE`
* **Path**: `/api/uoms/:id`
* **Auth Required**: Yes

---

### 4.10 Modul: Item & Package Management (`/api/items`)

Modul ini mendukung dua tipe barang:

1. `single`: Barang satuan.
2. `package`: Paket bundel yang tersusun dari beberapa barang `single`.

#### 1. List Items

* **Method**: `GET`
* **Path**: `/api/items`
* **Auth Required**: Yes
* **Query Params Tambahan**:
  * `itemType` (string, opsional): `single` atau `package` untuk menyaring tipe.

#### 2. Detail Item / Package

* **Method**: `GET`
* **Path**: `/api/items/:id`
* **Auth Required**: Yes
* **Response Sukses (200) - Tipe Single**:

  ```json
  {
    "meta": { ... },
    "data": {
      "record": {
        "id": "1d8bf42f-871c-4b3c-8ab6-9cba175fd222",
        "code": "LAPTOP_01",
        "name": "Laptop ThinkPad E14",
        "description": "Laptop Lenovo ThinkPad E14 Gen 4",
        "uomId": "48fa7d3c-9a1b-4f7f-82a1-6a0cf2ee9922",
        "categoryId": "36d2c4b5-1a1a-2b2b-3c3c-4d4d5e5e6f6f",
        "barcodeText": "8886008101234",
        "barcodeType": "EAN-13",
        "imageUrl": "https://example.com/images/laptop.jpg",
        "itemType": "single",
        "purchasePrice": 12000000.00,
        "sellingPrice": 14500000.00,
        "discountPercentage": 0.00,
        "discountPrice": 0.00,
        "priceAfterDiscount": 14500000.00,
        "isActive": true,
        "details": []
      }
    }
  }
  ```

* **Response Sukses (200) - Tipe Package (Memiliki Detail Komponen)**:

  ```json
  {
    "meta": { ... },
    "data": {
      "record": {
        "id": "9a1b4f7f-82a1-6a0cf2ee9922-871c-4b3c",
        "code": "PAKET_KERJA_01",
        "name": "Paket Laptop Kerja Lengkap",
        "description": "Paket bundling Laptop + Mouse + Tas",
        "uomId": "48fa7d3c-9a1b-4f7f-82a1-6a0cf2ee9922",
        "categoryId": "36d2c4b5-1a1a-2b2b-3c3c-4d4d5e5e6f6f",
        "barcodeText": "8886008109999",
        "barcodeType": "EAN-13",
        "imageUrl": "https://example.com/images/paket-kerja.jpg",
        "itemType": "package",
        "purchasePrice": 13000000.00,
        "sellingPrice": 16000000.00,
        "discountPercentage": 5.00,
        "discountPrice": 800000.00,
        "priceAfterDiscount": 15200000.00,
        "isActive": true,
        "details": [
          {
            "id": "ee1a1a1a-2b2b-3c3c-4d4d-5e5e6f6f7g7g",
            "packageItemId": "9a1b4f7f-82a1-6a0cf2ee9922-871c-4b3c",
            "childItemId": "1d8bf42f-871c-4b3c-8ab6-9cba175fd222",
            "childItemName": "Laptop ThinkPad E14",
            "quantity": 1,
            "price": 14500000.00,
            "discountPercentage": 0.00,
            "discountPrice": 0.00,
            "priceAfterDiscount": 14500000.00,
            "isActive": true
          },
          {
            "id": "ff2b2b2b-3c3c-4d4d-5e5e-6f6f7g7g8h8h",
            "packageItemId": "9a1b4f7f-82a1-6a0cf2ee9922-871c-4b3c",
            "childItemId": "2a3b4c5d-6e7f-8a9b-0c1d-2e3f4a5b6c7d",
            "childItemName": "Mouse Wireless Logitech",
            "quantity": 1,
            "price": 1500000.00,
            "discountPercentage": 10.00,
            "discountPrice": 150000.00,
            "priceAfterDiscount": 1350000.00,
            "isActive": true
          }
        ]
      }
    }
  }
  ```

#### 3. Create Item (Single atau Package)

* **Method**: `POST`
* **Path**: `/api/items`
* **Auth Required**: Yes
* **Skenario A - Membuat Item Single**:

  ```json
  {
    "code": "LAPTOP_01",
    "name": "Laptop ThinkPad E14",
    "description": "Lenovo ThinkPad E14",
    "uomId": "48fa7d3c-9a1b-4f7f-82a1-6a0cf2ee9922",
    "categoryId": "36d2c4b5-1a1a-2b2b-3c3c-4d4d5e5e6f6f",
    "barcodeText": "8886008101234",
    "barcodeType": "EAN-13",
    "imageUrl": "https://example.com/images/laptop.jpg",
    "itemType": "single",
    "purchasePrice": 12000000.00,
    "sellingPrice": 14500000.00,
    "isActive": true
  }
  ```

* **Skenario B - Membuat Item Package (Bundling)**:
  *Jika `itemType` bernilai `package`, properti `details` wajib dikirimkan minimal 1 item komponen.*

  ```json
  {
    "code": "PAKET_KERJA_01",
    "name": "Paket Laptop Kerja Lengkap",
    "description": "Paket bundling Laptop + Mouse",
    "uomId": "48fa7d3c-9a1b-4f7f-82a1-6a0cf2ee9922",
    "categoryId": "36d2c4b5-1a1a-2b2b-3c3c-4d4d5e5e6f6f",
    "barcodeText": "8886008109999",
    "barcodeType": "EAN-13",
    "imageUrl": "https://example.com/images/paket-kerja.jpg",
    "itemType": "package",
    "purchasePrice": 13000000.00,
    "sellingPrice": 16000000.00,
    "discountPercentage": 5.00,
    "isActive": true,
    "details": [
      {
        "childItemId": "1d8bf42f-871c-4b3c-8ab6-9cba175fd222",
        "quantity": 1,
        "price": 14500000.00,
        "discountPercentage": 0.00
      },
      {
        "childItemId": "2a3b4c5d-6e7f-8a9b-0c1d-2e3f4a5b6c7d",
        "quantity": 1,
        "price": 1500000.00,
        "discountPercentage": 10.00
      }
    ]
  }
  ```

  *(Server akan secara otomatis menghitung `discountPrice` dan `priceAfterDiscount` dari harga dasar paket).*

#### 4. Update Item / Package

* **Method**: `PUT`
* **Path**: `/api/items/:id`
* **Auth Required**: Yes
* **Request Payload**: (Kirim parameter yang ingin diubah secara parsial. Anda juga dapat memperbarui daftar `details` untuk tipe package).

#### 5. Delete Item

* **Method**: `DELETE`
* **Path**: `/api/items/:id`
* **Auth Required**: Yes

---

## 27. Assembly Order API

Modul ini digunakan untuk mengelola perakitan barang (Assembly Order) dari bahan mentah menjadi produk jadi bertipe `package`.

#### 1. Get Assembly Order List

* **Method**: `GET`
* **Path**: `/api/assembly-orders`
* **Auth Required**: Yes
* **Query Parameters**:
  * `page` (number, default: 1)
  * `limit` (number, default: 10)
  * `status` (number, optional) - 0=Draft, 1=Pending, 2=Approved, 3=Rejected
  * `warehouseId` (string, optional)
  * `searchTerm` (string, optional)

#### 2. Get Assembly Order Detail

* **Method**: `GET`
* **Path**: `/api/assembly-orders/:id`
* **Auth Required**: Yes
* **Response Data**: Detail assembly order, item produk jadi, dan rincian komponen bahan baku yang digunakan.

#### 3. Create Assembly Order

* **Method**: `POST`
* **Path**: `/api/assembly-orders`
* **Auth Required**: Yes
* **Request Payload**:
  ```json
  {
    "warehouseId": "warehouse-uuid-here",
    "notes": "Catatan perakitan produk",
    "details": [
      {
        "itemId": "finished-good-package-item-uuid",
        "quantityProduced": 10
      }
    ]
  }
  ```
  *(Backend akan memvalidasi kecukupan stok bahan mentah secara real-time dan melakukan booking stok `reserved_qty` di database).*

#### 4. Approve Assembly Order

* **Method**: `POST`
* **Path**: `/api/assembly-orders/:id/approve`
* **Auth Required**: Yes
  *(Memicu pengurangan stok fisik komponen bahan baku, merestock produk jadi di gudang tujuan, menghitung HPP otomatis, dan merilis reserved stock).*

#### 5. Reject Assembly Order

* **Method**: `POST`
* **Path**: `/api/assembly-orders/:id/reject`
* **Auth Required**: Yes
  *(Membatalkan booking stok bahan baku dan mengembalikan `available_qty` seperti semula).*

