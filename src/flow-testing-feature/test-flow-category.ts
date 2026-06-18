/**
 * Flow Testing: Modul Category Item
 *
 * Test scenario yang dicakup:
 * 1. Login sebagai superadmin
 * 2. Create category baru
 * 3. Coba create category duplikat (expected 400)
 * 4. Get list categories (paginated)
 * 5. Search categories
 * 6. Get detail by ID
 * 7. Update category
 * 8. Soft delete category
 * 9. Verifikasi soft delete
 * 10. Cleanup data test
 *
 * Prasyarat:
 * - Server berjalan di http://localhost:3000
 * - Migration sudah dijalankan (`bun run db:migrate`)
 * - Seeding sudah dijalankan (`bun run db:seed`)
 */

import { eq } from "drizzle-orm";
import { db } from "../core/db";
import { itemCategories } from "../modules/category/category.schema";

const BASE_URL = "http://localhost:3000/api";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function log(msg: string) {
  console.log(msg);
}

function section(title: string) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`▶ ${title}`);
  console.log("─".repeat(60));
}

async function apiCall(
  method: string,
  path: string,
  token?: string,
  body?: unknown
): Promise<{ status: number; data: any }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json() as any;
  return { status: res.status, data };
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

async function cleanupCategory(categoryId: string) {
  await db.delete(itemCategories).where(eq(itemCategories.id, categoryId));
}

// ─── Login ────────────────────────────────────────────────────────────────────

async function loginAsSuperadmin(): Promise<string> {
  const { status, data } = await apiCall("POST", "/auth/login", undefined, {
    email: "adminit@gmail.com",
    password: "12345678",
  });

  if (status !== 200 || !data.data?.record?.accessToken) {
    throw new Error(`Login failed! Status: ${status}, Response: ${JSON.stringify(data)}`);
  }

  log(`✓ Login sukses sebagai: ${data.data.record.email}`);
  return data.data.record.accessToken;
}

// ─── Main Test Runner ─────────────────────────────────────────────────────────

async function runCategoryFlowTests() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║        FLOW TESTING: MODUL CATEGORY ITEM                ║");
  console.log("╚══════════════════════════════════════════════════════════╝");

  let token: string;
  let createdCategoryId: string;

  // 1. LOGIN
  section("1. Login sebagai Superadmin");
  token = await loginAsSuperadmin();

  // 2. GET LIST AWAL
  section("2. GET /api/categories — List sebelum create");
  const listBefore = await apiCall("GET", "/api/categories?page=1&limit=5", token);
  log(`Status: ${listBefore.status}`);
  log(`Total Record sebelum create: ${listBefore.data.meta?.pagination?.totalRecord}`);

  // 3. CREATE CATEGORY
  section("3. POST /api/categories — Create category baru");
  const createRes = await apiCall("POST", "/api/categories", token, {
    code: "CAT-TEST-001",
    name: "Elektronik Testing",
    description: "Kategori untuk keperluan flow testing",
    isActive: true,
  });
  log(`Status: ${createRes.status}`);
  log(`Response: ${JSON.stringify(createRes.data, null, 2)}`);

  if (createRes.status !== 200) throw new Error("CREATE category gagal!");
  createdCategoryId = createRes.data.data.record.id;
  log(`✓ Category dibuat dengan ID: ${createdCategoryId}`);
  log(`✓ Code tersimpan uppercase: ${createRes.data.data.record.code}`);

  // 4. CREATE DUPLIKAT (harus gagal)
  section("4. POST /api/categories — Duplikat code (expected 400)");
  const dupRes = await apiCall("POST", "/api/categories", token, {
    code: "CAT-TEST-001",
    name: "Duplikat Category",
  });
  log(`Status: ${dupRes.status} (expected: 400)`);
  log(`Message: ${dupRes.data.meta?.exceptionMessage}`);
  if (dupRes.status !== 400) throw new Error("Seharusnya gagal karena code duplikat!");
  log("✓ Validasi duplikat code berjalan dengan benar");

  // 5. GET BY ID
  section("5. GET /api/categories/:id — Get detail category");
  const getRes = await apiCall("GET", `/api/categories/${createdCategoryId}`, token);
  log(`Status: ${getRes.status}`);
  log(`Name: ${getRes.data.data?.record?.name}`);
  log(`Code: ${getRes.data.data?.record?.code}`);
  log(`isActive: ${getRes.data.data?.record?.isActive}`);
  if (getRes.status !== 200) throw new Error("GET by ID category gagal!");
  log("✓ Detail category berhasil diambil");

  // 6. GET LIST DENGAN PAGINATION
  section("6. GET /api/categories?page=1&limit=5 — List dengan pagination");
  const listAfter = await apiCall("GET", "/api/categories?page=1&limit=5", token);
  log(`Status: ${listAfter.status}`);
  log(`Total Record: ${listAfter.data.meta?.pagination?.totalRecord}`);
  log(`Records di halaman ini: ${listAfter.data.data?.records?.length}`);
  log(`nextPage: ${listAfter.data.meta?.pagination?.nextPage}`);
  log(`previousPage: ${listAfter.data.meta?.pagination?.previousPage}`);

  // 7. SEARCH CATEGORY
  section("7. GET /api/categories?searchTerm=Elektronik&filterColumn=name — Pencarian");
  const searchRes = await apiCall("GET", "/api/categories?searchTerm=Elektronik&filterColumn=name", token);
  log(`Status: ${searchRes.status}`);
  log(`Hasil pencarian "Elektronik": ${searchRes.data.data?.records?.length} record`);
  if (searchRes.data.data?.records?.length === 0) {
    throw new Error("Pencarian seharusnya menemukan data!");
  }
  log("✓ Fungsi search berjalan dengan benar");

  // 8. UPDATE CATEGORY
  section("8. PUT /api/categories/:id — Update category");
  const updateRes = await apiCall("PUT", `/api/categories/${createdCategoryId}`, token, {
    name: "Elektronik Testing (Updated)",
    description: "Deskripsi diupdate saat flow testing",
    isActive: false,
  });
  log(`Status: ${updateRes.status}`);
  log(`Updated Name: ${updateRes.data.data?.record?.name}`);
  log(`Updated isActive: ${updateRes.data.data?.record?.isActive}`);
  if (updateRes.status !== 200) throw new Error("UPDATE category gagal!");
  log("✓ Category berhasil diupdate");

  // 9. VALIDASI UUID INVALID
  section("9. GET /api/categories/invalid-uuid — Validasi UUID (expected 400)");
  const invalidRes = await apiCall("GET", "/api/categories/invalid-uuid-format", token);
  log(`Status: ${invalidRes.status} (expected: 400)`);
  log(`Message: ${invalidRes.data.meta?.exceptionMessage}`);
  if (invalidRes.status !== 400) throw new Error("Seharusnya 400 untuk UUID invalid!");
  log("✓ Validasi UUID berjalan dengan benar");

  // 10. SOFT DELETE CATEGORY
  section("10. DELETE /api/categories/:id — Soft delete category");
  const deleteRes = await apiCall("DELETE", `/api/categories/${createdCategoryId}`, token);
  log(`Status: ${deleteRes.status}`);
  if (deleteRes.status !== 200) throw new Error("DELETE category gagal!");
  log("✓ Category berhasil di-soft-delete");

  // 11. VERIFIKASI SOFT DELETE
  section("11. Verifikasi soft-delete — GET by ID (expected 400)");
  const getDeletedRes = await apiCall("GET", `/api/categories/${createdCategoryId}`, token);
  log(`Status: ${getDeletedRes.status} (expected: 400)`);
  if (getDeletedRes.status !== 400) throw new Error("Data seharusnya sudah ter-soft-delete!");
  log("✓ Verifikasi soft-delete berhasil — data tidak muncul di API");

  // Verifikasi data tetap ada di DB (soft delete)
  const dbCheck = await db
    .select({ id: itemCategories.id, deletedAt: itemCategories.deletedAt })
    .from(itemCategories)
    .where(eq(itemCategories.id, createdCategoryId))
    .limit(1);
  log(`DB Check — deletedAt: ${dbCheck[0]?.deletedAt} (harus ada timestamp)`);

  // ─── CLEANUP ──────────────────────────────────────────────────────────────────
  section("CLEANUP — Menghapus data test dari database");
  await cleanupCategory(createdCategoryId);
  log("✓ Data test category berhasil dihapus dari DB");

  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║     ✅ SEMUA CATEGORY TESTS BERHASIL!                   ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  process.exit(0);
}

runCategoryFlowTests().catch((err) => {
  console.error("\n❌ CATEGORY FLOW TEST GAGAL:", err.message);
  process.exit(1);
});
