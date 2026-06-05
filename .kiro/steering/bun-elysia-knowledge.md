# Bun + Elysia Knowledge

Learnings, gotchas, and best practices discovered while working with Bun runtime and Elysia framework.

---

## [2026-06-05] Jangan Asumsikan Express/Node.js Pattern di Project Bun + Elysia

**Type:** Gotcha
**Context:** Membuat issue planning untuk implementasi Users API dan Register endpoint di project yang menggunakan Bun + Elysia + Drizzle ORM.

**Problem:**
Global steering `base-nodejs-backend-tech.md` mendokumentasikan stack Express + Node.js. Saat membuat planning untuk project ini, ada risiko implementor (junior atau AI model lain) mengikuti pattern Express (misalnya `req`, `res`, `app.use()`, `express.Router()`) karena steering tersebut tersedia di context — padahal project ini pakai Elysia yang memiliki API dan pattern yang berbeda.

**Solution / Lesson:**
Selalu cek `package.json` dan `src/index.ts` terlebih dahulu sebelum membuat planning atau implementasi. Project ini menggunakan:
- Runtime: **Bun** (bukan Node.js)
- HTTP Framework: **Elysia** (bukan Express)
- Pattern routing Elysia menggunakan `.use()` dengan instance Elysia baru, bukan `express.Router()`

Issue atau spec yang dibuat harus secara eksplisit menyebutkan runtime dan framework yang digunakan agar implementor tidak salah mengikuti steering lain.

**Avoid:**
Jangan gunakan `express`, `Router()`, `req/res` pattern, atau `app.listen()` ala Express di project Bun + Elysia.

---

## [2026-06-05] bcryptjs vs bcrypt di Bun

**Type:** Gotcha
**Context:** Merencanakan password hashing untuk fitur registrasi user di project Bun + Elysia.

**Problem:**
Package `bcrypt` menggunakan C native binding yang belum stabil atau tidak kompatibel dengan Bun runtime. Menggunakan `bcrypt` di Bun bisa menyebabkan error saat install atau runtime.

**Solution / Lesson:**
Gunakan **`bcryptjs`** (pure JavaScript implementation) sebagai pengganti `bcrypt` di project Bun. Install dengan:
```bash
bun add bcryptjs
bun add -d @types/bcryptjs
```
API-nya identik dengan `bcrypt` sehingga tidak ada perubahan pada cara pemakaian.

**Avoid:**
Jangan gunakan `bcrypt` (native binding) di project Bun — selalu gunakan `bcryptjs`.

---

## [2026-06-05] Panjang Kolom password di DB Harus Cukup untuk Hash bcrypt

**Type:** Bug Fix
**Context:** Mendefinisikan skema tabel `users` dengan kolom `password`.

**Problem:**
Spesifikasi awal menyebutkan `password varchar(20)` mengacu pada panjang maksimum input user. Namun bcrypt menghasilkan hash dengan panjang ±60 karakter — menyimpan hash ke kolom `varchar(20)` akan menyebabkan error truncation atau insert gagal.

**Solution / Lesson:**
Kolom `password` di database harus didefinisikan sebagai `varchar(255)` untuk menampung hasil hash bcrypt. Batasan panjang input (misal max 72 karakter, sesuai limit bcrypt) diterapkan di layer validasi request, bukan di definisi kolom DB.

**Avoid:**
Jangan definisikan kolom password dengan panjang yang mengacu pada panjang input user. Selalu gunakan `varchar(255)` atau lebih untuk kolom yang menyimpan hash.

---

## [2026-06-05] Drizzle Kit migrate Gagal Tanpa Pesan Error Jelas Jika DB Belum Ada

**Type:** Gotcha
**Context:** Menjalankan `bun run db:migrate` (drizzle-kit migrate) setelah schema baru di-generate, tapi database belum dibuat di server.

**Problem:**
`drizzle-kit migrate` gagal dengan exit code 1 dan output hanya `[⣷] applying migrations...` tanpa pesan error yang jelas. Tidak ada stack trace atau keterangan koneksi gagal. Ini membuat debugging sulit karena tidak jelas apakah masalahnya ada di schema, koneksi, atau DB yang belum exist.

**Solution / Lesson:**
Pastikan database sudah dibuat di server PostgreSQL sebelum menjalankan `db:migrate`. Setelah database dibuat, `bun run db:migrate` langsung berhasil dengan output `[✓] migrations applied successfully!`.

**Avoid:**
Jangan langsung asumsikan ada bug di kode atau config saat `drizzle-kit migrate` gagal tanpa pesan — cek dulu apakah database target sudah exist di server.

---

## [2026-06-05] DATABASE_URL Harus Ada di .env untuk Drizzle Kit

**Type:** Gotcha
**Context:** Menjalankan `bun run db:migrate` dengan `.env` yang hanya berisi variabel `POSTGRES_DSN`, `POSTGRES_USER`, `POSTGRES_HOST`, dll. tapi tidak ada `DATABASE_URL`.

**Problem:**
Drizzle Kit membutuhkan `DATABASE_URL` dalam format connection string (`postgresql://user:pass@host:port/db`). Variabel libpq terpisah (`POSTGRES_HOST`, `POSTGRES_USER`, dst.) tidak dikenali oleh Drizzle Kit — menghasilkan error `url: undefined`.

**Solution / Lesson:**
Tambahkan `DATABASE_URL` ke `.env` dalam format URL lengkap:
```
DATABASE_URL=postgresql://user:password@host:5432/dbname
```
Drizzle Kit v0.31+ otomatis membaca `.env` di working directory tanpa perlu konfigurasi tambahan.

**Avoid:**
Jangan asumsikan Drizzle Kit bisa membaca env terpisah seperti `POSTGRES_HOST` + `POSTGRES_USER` — selalu sediakan `DATABASE_URL` sebagai connection string lengkap.

---

## [2026-06-05] TypeScript Error: result[0] dari Drizzle .returning() Bisa Undefined

**Type:** Bug Fix
**Context:** Membuat `UserModel.createUser()` yang menggunakan Drizzle `.insert().returning()` dengan return type `UserRecord` (non-nullable).

**Problem:**
TypeScript melaporkan error karena `result[0]` dari array hasil `.returning()` bertipe `UserRecord | undefined`, tapi fungsi menjanjikan return type `UserRecord`. TypeScript strict mode mendeteksi ini sebagai type mismatch.

**Solution / Lesson:**
Tambahkan guard setelah insert:
```ts
if (!result[0]) {
  throw new Error("Insert did not return a record");
}
return result[0];
```
Ini sekaligus menangani edge case jika insert gagal secara silent.

**Avoid:**
Jangan langsung return `result[0]` dari `.returning()` tanpa null check jika return type fungsi adalah non-nullable.

---

## [2026-06-05] Elysia Middleware Menggunakan .derive() Bukan Express-style next()

**Type:** Best Practice
**Context:** Membuat planning Auth API (login, refresh-token, logout) dengan protected route untuk logout yang membutuhkan Bearer token validation.

**Problem:**
Ada risiko implementor menulis middleware autentikasi menggunakan pola Express (`function(req, res, next)`) karena global steering `base-nodejs-backend-tech.md` mendokumentasikan Express middleware. Pola ini tidak valid di Elysia dan akan menyebabkan error.

**Solution / Lesson:**
Di Elysia, middleware/guard diimplementasikan via `.derive()` atau `.guard()`. Untuk autentikasi Bearer token, gunakan:
```ts
export const authMiddleware = new Elysia()
  .derive({ as: "scoped" }, ({ headers }) => {
    const authorization = headers["authorization"];
    // validasi token di sini
    // return { user: decodedPayload } jika valid
  });
```
Gunakan `{ as: "scoped" }` agar derive tidak bocor ke route lain yang tidak memerlukannya. Mount middleware ke route dengan `.use(authMiddleware)` sebelum route yang ingin diproteksi.

**Avoid:**
Jangan gunakan pola `(req, res, next) => { next() }` ala Express di Elysia — tidak akan bekerja.

---

## [2026-06-05] JWT_SECRET dan JWT_REFRESH_SECRET Harus Selalu Berbeda

**Type:** Best Practice
**Context:** Merancang sistem auth JWT dengan access token + refresh token di project Bun + Elysia.

**Problem:**
Menggunakan secret yang sama untuk sign access token dan refresh token berarti refresh token bisa diterima di endpoint yang seharusnya hanya menerima access token (dan sebaliknya). Ini membuka celah keamanan karena refresh token biasanya memiliki masa berlaku jauh lebih panjang.

**Solution / Lesson:**
Selalu gunakan dua secret berbeda di `.env`:
```env
JWT_SECRET=<secret_untuk_access_token>
JWT_REFRESH_SECRET=<secret_untuk_refresh_token>
```
Minimal 32 karakter untuk setiap secret. Sign dan verify setiap token type hanya dengan secret yang sesuai.

**Avoid:**
Jangan gunakan nilai yang sama untuk `JWT_SECRET` dan `JWT_REFRESH_SECRET`.

---

## [2026-06-05] Pesan Error Login Harus Identik untuk "User Tidak Ada" vs "Password Salah"

**Type:** Best Practice
**Context:** Merancang alur login di `AuthController.login()` untuk mencegah user enumeration attack.

**Problem:**
Jika pesan error berbeda antara "email tidak ditemukan" (`"Email not found"`) dan "password salah" (`"Wrong password"`), attacker bisa mengetahui apakah suatu email terdaftar di sistem hanya dengan mencoba login — ini disebut user enumeration attack.

**Solution / Lesson:**
Gunakan pesan error yang **identik** untuk kedua kondisi:
```ts
// User tidak ditemukan
return failedResponse(correlationId, "Data not found!", 400, "Email or password is incorrect");

// Password salah
return failedResponse(correlationId, "Data not found!", 400, "Email or password is incorrect");
```
Ini memastikan attacker tidak bisa membedakan apakah email terdaftar atau tidak.

**Avoid:**
Jangan gunakan pesan berbeda seperti `"Email not registered"` vs `"Incorrect password"` pada endpoint login.

---

## [2026-06-05] ctx.params di Elysia Bertipe string | undefined, Bukan string

**Type:** Bug Fix
**Context:** Mengimplementasikan endpoint `GET /:id`, `PATCH /:id/status`, dan `DELETE /:id` di `UserController.ts` menggunakan Elysia framework.

**Problem:**
TypeScript melaporkan error `Argument of type 'string | undefined' is not assignable to parameter of type 'string'` saat mengakses `ctx.params.id` dan meneruskannya ke fungsi model. Elysia mengetik `ctx.params` dengan nilai yang bisa `undefined`, sehingga cast langsung ke `Record<string, string>` tidak cukup.

**Solution / Lesson:**
Cast `ctx.params` ke `Record<string, string | undefined>` lalu tambahkan fallback `?? ""`:
```ts
const id = (ctx.params as Record<string, string | undefined>).id ?? "";
```
Nilai kosong (`""`) akan gagal UUID validation regex di langkah berikutnya sehingga tidak perlu penanganan terpisah.

**Avoid:**
Jangan cast `ctx.params` ke `Record<string, string>` (tanpa `| undefined`) — TypeScript strict mode akan menolaknya.

---

## [2026-06-05] Drizzle asc()/desc() Memerlukan AnyColumn, Bukan Column Union Type

**Type:** Bug Fix
**Context:** Mengimplementasikan dynamic sorting di `UserModel.findAll()` menggunakan Drizzle ORM. Kolom sort di-resolve dari string key ke kolom Drizzle via mapping object.

**Problem:**
TypeScript melaporkan error `Argument of type 'SortableColumn' is not assignable to parameter of type 'SQLWrapper | AnyColumn'. Type 'undefined' is not assignable to type 'SQLWrapper | AnyColumn'` saat memanggil `asc(column)` atau `desc(column)`. Ini terjadi karena `SortableColumn` didefinisikan sebagai `(typeof users)[keyof typeof users]` yang mencakup tipe non-column (seperti tabel itu sendiri) dan bisa `undefined`.

**Solution / Lesson:**
Import `AnyColumn` dari `drizzle-orm` dan gunakan sebagai return type fungsi resolver:
```ts
import type { AnyColumn } from "drizzle-orm";

function resolveOrderColumn(key: string): AnyColumn {
  const map: Record<string, AnyColumn> = {
    Id: users.id,
    Name: users.name,
    // ...
  };
  return (map[key] ?? users.createdAt) as AnyColumn;
}
```

**Avoid:**
Jangan gunakan `(typeof users)[keyof typeof users]` sebagai tipe untuk kolom yang akan digunakan di `asc()`/`desc()` — tipe tersebut terlalu lebar dan tidak kompatibel.

---

## [2026-06-05] Elysia derive() Dapat Throw Object (bukan Error) untuk Early Return

**Type:** Best Practice
**Context:** Mengimplementasikan `authMiddleware` menggunakan Elysia `.derive()` yang harus mengembalikan `failedResponse` (bukan throw Error standar) ketika token tidak valid.

**Problem:**
Di Express, middleware melakukan early return via `res.status(401).json(...)`. Di Elysia dengan `.derive()`, tidak ada `res` objek — tidak ada cara langsung untuk menghentikan request dan mengirim response dari dalam derive callback menggunakan pattern biasa.

**Solution / Lesson:**
Gunakan `throw` di dalam `.derive()` callback dengan melempar object response (bukan `Error`). Elysia akan menangkap throw tersebut dan mengirimkannya sebagai response:
```ts
export const authMiddleware = new Elysia({ name: "authMiddleware" }).derive(
  { as: "scoped" },
  ({ headers }) => {
    // ...
    if (!authorization) {
      throw failedResponse(correlationId, "Token invalid.", 401);
    }
    // On success, return derived values
    return { user: decoded, correlationId };
  }
);
```
Dengan `{ as: "scoped" }`, derive hanya berlaku untuk routes di scope yang menggunakan middleware ini — tidak bocor ke route lain.

**Avoid:**
Jangan coba menggunakan Express-style `next()` atau memodifikasi response object secara langsung di dalam Elysia `.derive()`.

---

## [2026-06-05] jwt.sign() expiresIn Perlu di-cast ke jwt.SignOptions

**Type:** Bug Fix
**Context:** Menggunakan `jsonwebtoken` v9 di project Bun + TypeScript strict mode untuk generate JWT token.

**Problem:**
TypeScript melaporkan type error ketika `expiresIn` dari `process.env` (bertipe `string | undefined`) langsung dimasukkan ke options object `jwt.sign()`. TypeScript strict mode tidak menerima ini karena `expiresIn` di `SignOptions` memiliki tipe yang lebih spesifik.

**Solution / Lesson:**
Cast options object ke `jwt.SignOptions` secara eksplisit:
```ts
const accessToken = jwt.sign(payload, process.env.JWT_SECRET!, {
  expiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? "15m",
} as jwt.SignOptions);
```

**Avoid:**
Jangan langsung spread env string ke jwt options tanpa type assertion — akan error di strict mode.
