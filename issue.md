# Issue: Users Table & Register API

## Context

Project ini menggunakan **Bun** sebagai runtime, **Elysia** sebagai HTTP framework, dan **Drizzle ORM** dengan PostgreSQL. Struktur folder mengikuti konvensi yang ada di project.

---

## Scope of Work

### 1. Update Database Schema — Table `users`

File: `src/db/schema.ts`

Replace skema `users` yang ada saat ini dengan definisi berikut:

| Column | Type | Constraint |
|--------|------|------------|
| `id` | `uuid` | Primary key, default `gen_random_uuid()` |
| `name` | `varchar(255)` | Not null |
| `email` | `varchar(255)` | Not null, unique |
| `password` | `varchar(255)` | Not null (stored as bcrypt hash — **bukan plain text**) |
| `status` | `smallint` | Not null, default `1` — enum logis: `0` = inactive, `1` = active |
| `created_at` | `timestamp` | Not null, default `now()` |
| `updated_at` | `timestamp` | Nullable |

> ⚠️ Kolom `password` di DB harus `varchar(255)` untuk menampung hasil hash bcrypt (±60 karakter). Request body boleh membatasi panjang input, tapi kolom DB harus lebih panjang.

Contoh definisi Drizzle:

```ts
import { pgTable, uuid, varchar, smallint, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  status: smallint("status").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
});
```

Setelah update schema, jalankan migration:

```bash
bun run db:generate
bun run db:migrate
```

---

### 2. Install Dependency — bcryptjs

Karena Bun belum support native `bcrypt` (C binding), gunakan **`bcryptjs`** (pure JS, compatible dengan Bun):

```bash
bun add bcryptjs
bun add -d @types/bcryptjs
```

---

### 3. Struktur Folder yang Perlu Dibuat

Buat folder dan file berikut di dalam `src/`:

```
src/
├── db/
│   └── schema.ts              ← update (sudah ada)
├── utils/
│   └── response.ts            ← helper standar response envelope
├── validations/
│   └── userValidation.ts      ← validasi request body register
├── models/
│   └── UserModel.ts           ← query ke DB (Drizzle)
├── controllers/
│   └── UserController.ts      ← handler request
├── routes/
│   ├── userRoutes.ts          ← router domain users
│   └── apiRoutes.ts           ← router utama (prefix /api)
└── index.ts                   ← entry point (update untuk mount apiRoutes)
```

---

### 4. Response Helper — `src/utils/response.ts`

Semua response API harus mengikuti format envelope standar berikut:

```ts
// src/utils/response.ts

export interface PaginationMeta {
  page: number;
  limit: number;
  totalRecord: number;
  totalPage: number;
  nextPage: boolean;
  previousPage: boolean;
  nextPageURL: string;
  previousPageURL: string;
}

export interface ResponseMeta {
  correlationId: string;
  status: boolean;
  code: number;
  message: string;
  exceptionMessage: string;
  pagination?: PaginationMeta;
}

export interface StandardResponse<T = unknown> {
  meta: ResponseMeta;
  data: T | null;
}
```

Buat dua fungsi helper:

```ts
// Sukses — single record atau list
export function successResponse<T>(
  correlationId: string,
  message: string,
  data: T,
  pagination?: PaginationMeta
): StandardResponse<T>

// Gagal — validasi, business error, atau server error
export function failedResponse(
  correlationId: string,
  message: string,
  code: number,        // 400 | 401 | 500
  exceptionMessage?: string
): StandardResponse<null>
```

Format response sukses:
```json
{
  "meta": {
    "correlationId": "uuid-dari-header-atau-generated",
    "status": true,
    "code": 200,
    "message": "Data has been created",
    "exceptionMessage": ""
  },
  "data": null
}
```

Format response gagal:
```json
{
  "meta": {
    "correlationId": "uuid-dari-header-atau-generated",
    "status": false,
    "code": 400,
    "message": "Create data failed!",
    "exceptionMessage": "Email already registered"
  },
  "data": null
}
```

> **`correlationId`**: Baca dari request header `X-Correlation-ID`. Jika tidak ada, generate UUID baru dengan `crypto.randomUUID()`.

---

### 5. Validation — `src/validations/userValidation.ts`

Gunakan validasi bawaan Elysia (`t` dari `elysia`) atau buat manual. Aturan validasi untuk request body register:

| Field | Aturan |
|-------|--------|
| `name` | String, wajib, min 1 karakter, max 255 karakter |
| `email` | String, wajib, format email valid |
| `password` | String, wajib, min 8 karakter, max 72 karakter (limit bcrypt) |

> ⚠️ Jangan expose error validasi secara mentah ke client. Wrap dalam `failedResponse` dengan `code: 400`.

---

### 6. Model — `src/models/UserModel.ts`

Buat static class dengan dua method:

```ts
export class UserModel {
  // Cek apakah email sudah terdaftar — return user atau undefined
  static async findByEmail(email: string): Promise<UserRecord | undefined>

  // Insert user baru — return row yang baru dibuat
  static async createUser(payload: {
    name: string;
    email: string;
    password: string; // sudah di-hash sebelum dipanggil
  }): Promise<UserRecord>
}
```

Query menggunakan `db` dari `src/db/index.ts`. Untuk insert, set `status: 1` secara default di dalam model (tidak perlu diterima dari request).

---

### 7. Controller — `src/controllers/UserController.ts`

Buat static class `UserController` dengan method `register`:

**Alur logika:**

1. Ambil `correlationId` dari header `X-Correlation-ID` atau `crypto.randomUUID()`
2. Parse dan validasi request body (`name`, `email`, `password`)
3. Jika validasi gagal → return `failedResponse` code `400`, message `"Create data failed!"`, exceptionMessage berisi detail error
4. Cek apakah email sudah terdaftar via `UserModel.findByEmail`
5. Jika sudah ada → return `failedResponse` code `400`, message `"Create data failed!"`, exceptionMessage `"Email already registered"`
6. Hash password dengan `bcryptjs` (salt rounds: `10`)
7. Simpan ke DB via `UserModel.createUser`
8. Return `successResponse` code `200`, message `"Data has been created"`, `data: null`
9. Jika ada error tak terduga → return `failedResponse` code `500`, message `"Internal server error"`, exceptionMessage berisi `err.message`

> ⚠️ Jangan pernah return password (plain atau hash) di response.

---

### 8. Routes

**`src/routes/userRoutes.ts`**

```
POST /  → UserController.register
```

**`src/routes/apiRoutes.ts`**

Mount semua domain router dengan prefix `/api`:

```
/api/users  → userRoutes
```

**`src/index.ts`** — update untuk menggunakan `apiRoutes`:

```ts
import { Elysia } from "elysia";
import { apiRoutes } from "./routes/apiRoutes";

const app = new Elysia()
  .use(apiRoutes)
  .get("/health", () => ({ status: "ok" }))
  .listen(3000);
```

---

### 9. Endpoint Summary

| Method | URL | Auth | Deskripsi |
|--------|-----|------|-----------|
| `POST` | `/api/users` | ❌ Public | Register user baru |

**Request Body:**
```json
{
  "name": "Fadil Faishal",
  "email": "fadil@gmail.com",
  "password": "fadil123"
}
```

**Response Sukses (200):**
```json
{
  "meta": {
    "correlationId": "a1b2c3d4-e5f6-...",
    "status": true,
    "code": 200,
    "message": "Data has been created",
    "exceptionMessage": ""
  },
  "data": null
}
```

**Response Gagal — Email duplikat (400):**
```json
{
  "meta": {
    "correlationId": "a1b2c3d4-e5f6-...",
    "status": false,
    "code": 400,
    "message": "Create data failed!",
    "exceptionMessage": "Email already registered"
  },
  "data": null
}
```

**Response Gagal — Validasi (400):**
```json
{
  "meta": {
    "correlationId": "a1b2c3d4-e5f6-...",
    "status": false,
    "code": 400,
    "message": "Create data failed!",
    "exceptionMessage": "Input data not found or invalid!"
  },
  "data": null
}
```

---

## Checklist Implementasi

- [ ] Update `src/db/schema.ts` — ganti skema users sesuai spesifikasi
- [ ] Jalankan `bun run db:generate` dan `bun run db:migrate`
- [ ] Install `bcryptjs` dan `@types/bcryptjs`
- [ ] Buat `src/utils/response.ts` — helper `successResponse` dan `failedResponse`
- [ ] Buat `src/validations/userValidation.ts` — aturan validasi register
- [ ] Buat `src/models/UserModel.ts` — `findByEmail` dan `createUser`
- [ ] Buat `src/controllers/UserController.ts` — method `register`
- [ ] Buat `src/routes/userRoutes.ts` — POST `/`
- [ ] Buat `src/routes/apiRoutes.ts` — mount dengan prefix `/api`
- [ ] Update `src/index.ts` — gunakan `apiRoutes`
- [ ] Test endpoint dengan request sukses, email duplikat, dan body tidak valid

---

## Notes untuk Implementor

- Runtime adalah **Bun**, bukan Node.js. Framework HTTP adalah **Elysia**, bukan Express. Jangan gunakan Express pattern.
- Selalu return HTTP status `200` di level transport. Gunakan `meta.code` untuk kode hasil bisnis (lihat aturan di steering `api-response-standardization.md`).
- Jangan log atau return password dalam bentuk apapun.
- `status` user tidak diterima dari request — selalu set `1` saat register.
- Semua response harus menggunakan format envelope `{ meta, data }` tanpa exception.
