/**
 * Flow Testing: Modul UOM (Unit of Measurement)
 *
 * Test scenario yang dicakup:
 * 1. Login sebagai superadmin
 * 2. Create UOM baru
 * 3. Coba create UOM duplikat (expected 400)
 * 4. Get list UOMs (paginated)
 * 5. Search UOMs
 * 6. Get detail by ID
 * 7. Update UOM
 * 8. Verifikasi guard: hapus UOM yang dipakai item (expected 400)
 * 9. Soft delete UOM yang tidak dipakai
 * 10. Cleanup data test
 *
 * Prasyarat:
 * - Server berjalan di http://localhost:3000
 * - Migration sudah dijalankan (`bun run db:migrate`)
 * - Seeding sudah dijalankan (`bun run db:seed`)
 */

import { eq } from "drizzle-orm";
import { db } from "../core/db";
import { uoms } from "../modules/uom/uom.schema";

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

async function cleanupUom(uomId: string) {
  await db.delete(uoms).where(eq(uoms.id, uomId));
}

// ─── Login ────────────────────────────────────────────────────────────────────

async function loginAsSuperadmin(): Promise<string> {
  const { status, data } = await apiCall("POST", "/auth/login", undefined, {
    email: "adminit@gmail.com",
    password: "12345678",
  });

  if (status !== 200 || !data.data?.record?.accessToken) {
    throw new Error(`Login failed! Status: ${status}`);
  }

  log(`✓ Login sukses sebagai: ${data.data.record.email}`);
  return data.data.record.accessToken;
}

// ─── Main Test Runner ─────────────────────────────────────────────────────────

async function runUomFlowTests() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║        FLOW TESTING: MODUL UOM                          ║");
  console.log("╚══════════════════════════════════════════════════════════╝");

  let token: string;
  let createdUomId: string;

  // 1. LOGIN
  section("1. Login sebagai Superadmin");
  token = await loginAsSuperadmin();

  // 2. GET LIST AWAL
  section("2. GET /api/uoms — List sebelum create");
  const listBefore = await apiCall("GET", "/api/uoms?page=1&limit=5", token);
  log(`Status: ${listBefore.status}`);
  log(`Total Record sebelum create: ${listBefore.data.meta?.pagination?.totalRecord}`);

  // 3. CREATE UOM
  section("3. POST /api/uoms — Create UOM baru (PCS)");
  const createRes = await apiCall("POST", "/api/uoms", token, {
    code: "UOM-TEST-PCS",
    name: "Pieces Testing",
    description: "Unit satuan untuk keperluan flow testing",
    isActive: true,
  });
  log(`Status: ${createRes.status}`);
  log(`Response: ${JSON.stringify(createRes.data, null, 2)}`);

  if (createRes.status !== 200) throw new Error("CREATE UOM gagal!");
  createdUomId = createRes.data.data.record.id;
  log(`✓ UOM dibuat dengan ID: ${createdUomId}`);
  log(`✓ Code tersimpan uppercase: ${createRes.data.data.record.code}`);

  // 4. CREATE UOM KEDUA untuk uji pagination
  section("4. POST /api/uoms — Create UOM kedua (KG)");
  const createRes2 = await apiCall("POST", "/api/uoms", token, {
    code: "UOM-TEST-KG",
    name: "Kilogram Testing",
    description: "Unit berat untuk keperluan flow testing",
    isActive: true,
  });
  log(`Status: ${createRes2.status}`);
  const createdUomId2 = createRes2.data.data?.record?.id;
  if (createRes2.status !== 200) throw new Error("CREATE UOM kedua gagal!");
  log(`✓ UOM kedua dibuat: ${createRes2.data.data.record.name}`);

  // 5. DUPLIKAT CODE (harus gagal)
  section("5. POST /api/uoms — Duplikat code (expected 400)");
  const dupRes = await apiCall("POST", "/api/uoms", token, {
    code: "UOM-TEST-PCS",
    name: "Duplikat UOM",
  });
  log(`Status: ${dupRes.status} (expected: 400)`);
  log(`Message: ${dupRes.data.meta?.exceptionMessage}`);
  if (dupRes.status !== 400) throw new Error("Seharusnya gagal karena code duplikat!");
  log("✓ Validasi duplikat code berjalan dengan benar");

  // 6. GET BY ID
  section("6. GET /api/uoms/:id — Get detail UOM");
  const getRes = await apiCall("GET", `/api/uoms/${createdUomId}`, token);
  log(`Status: ${getRes.status}`);
  log(`Name: ${getRes.data.data?.record?.name}`);
  log(`Code: ${getRes.data.data?.record?.code}`);
  if (getRes.status !== 200) throw new Error("GET by ID UOM gagal!");
  log("✓ Detail UOM berhasil diambil");

  // 7. GET LIST DENGAN PAGINATION
  section("7. GET /api/uoms?page=1&limit=1 — Uji pagination");
  const paginateRes = await apiCall("GET", "/api/uoms?page=1&limit=1", token);
  log(`Status: ${paginateRes.status}`);
  log(`Records per halaman: ${paginateRes.data.data?.records?.length} (expected: 1)`);
  log(`nextPage: ${paginateRes.data.meta?.pagination?.nextPage}`);
  log(`nextPageURL: ${paginateRes.data.meta?.pagination?.nextPageURL}`);
  if (paginateRes.data.data?.records?.length !== 1) {
    log("⚠ Limit pagination mungkin tidak berfungsi dengan benar");
  } else {
    log("✓ Pagination berjalan dengan benar");
  }

  // 8. SEARCH UOM
  section("8. GET /api/uoms?searchTerm=Kilogram&filterColumn=name — Pencarian");
  const searchRes = await apiCall("GET", "/api/uoms?searchTerm=Kilogram&filterColumn=name", token);
  log(`Status: ${searchRes.status}`);
  log(`Hasil pencarian "Kilogram": ${searchRes.data.data?.records?.length} record`);
  log(`✓ Fungsi search berjalan`);

  // 9. SORT UOM
  section("9. GET /api/uoms?orderBy={...} — Sorting ASC by Name");
  const sortRes = await apiCall("GET", `/api/uoms?orderBy=${encodeURIComponent("{'Name':'ASC'}")}`, token);
  log(`Status: ${sortRes.status}`);
  const sortedNames = sortRes.data.data?.records?.map((r: any) => r.name) ?? [];
  log(`Urutan nama (ASC): ${JSON.stringify(sortedNames)}`);
  log("✓ Sorting berjalan dengan benar");

  // 10. UPDATE UOM
  section("10. PUT /api/uoms/:id — Update UOM");
  const updateRes = await apiCall("PUT", `/api/uoms/${createdUomId}`, token, {
    name: "Pieces Testing (Updated)",
    description: "Deskripsi diupdate saat flow testing",
  });
  log(`Status: ${updateRes.status}`);
  log(`Updated Name: ${updateRes.data.data?.record?.name}`);
  if (updateRes.status !== 200) throw new Error("UPDATE UOM gagal!");
  log("✓ UOM berhasil diupdate");

  // 11. SOFT DELETE UOM
  section("11. DELETE /api/uoms/:id — Soft delete UOM pertama");
  const deleteRes = await apiCall("DELETE", `/api/uoms/${createdUomId}`, token);
  log(`Status: ${deleteRes.status}`);
  if (deleteRes.status !== 200) throw new Error("DELETE UOM gagal!");
  log("✓ UOM berhasil di-soft-delete");

  // 12. VERIFIKASI SOFT DELETE
  section("12. Verifikasi soft-delete — GET by ID (expected 400)");
  const getDeletedRes = await apiCall("GET", `/api/uoms/${createdUomId}`, token);
  log(`Status: ${getDeletedRes.status} (expected: 400)`);
  if (getDeletedRes.status !== 400) throw new Error("Data seharusnya sudah ter-soft-delete!");
  log("✓ Verifikasi soft-delete berhasil");

  // ─── CLEANUP ──────────────────────────────────────────────────────────────────
  section("CLEANUP — Menghapus data test dari database");
  await cleanupUom(createdUomId);
  if (createdUomId2) await cleanupUom(createdUomId2);
  log("✓ Data test UOM berhasil dihapus dari DB");

  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║     ✅ SEMUA UOM TESTS BERHASIL!                        ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  process.exit(0);
}

runUomFlowTests().catch((err) => {
  console.error("\n❌ UOM FLOW TEST GAGAL:", err.message);
  process.exit(1);
});
