/**
 * Flow Testing: Modul Warehouse
 *
 * Test scenario yang dicakup:
 * 1. Login sebagai superadmin untuk mendapatkan token
 * 2. Create warehouse baru
 * 3. Get list warehouse (paginated)
 * 4. Get detail warehouse by ID
 * 5. Update warehouse
 * 6. Assign warehouse head (user)
 * 7. Get warehouse heads by warehouse ID
 * 8. Unassign warehouse head
 * 9. Delete warehouse (soft delete)
 * 10. Verifikasi data sudah soft-deleted (tidak muncul di list)
 *
 * Prasyarat:
 * - Server berjalan di http://localhost:3000
 * - Migration sudah dijalankan (`bun run db:migrate`)
 * - Seeding sudah dijalankan (`bun run db:seed`)
 */

import { eq, isNull, and } from "drizzle-orm";
import { db } from "../core/db";
import { warehouses, warehouseHeads } from "../modules/warehouse/warehouse.schema";
import { UserModel } from "../modules/user";

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

async function cleanupWarehouse(warehouseId: string) {
  // Hard delete untuk cleanup test data
  await db.delete(warehouseHeads).where(eq(warehouseHeads.warehouseId, warehouseId));
  await db.delete(warehouses).where(eq(warehouses.id, warehouseId));
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

async function runWarehouseFlowTests() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║        FLOW TESTING: MODUL WAREHOUSE                    ║");
  console.log("╚══════════════════════════════════════════════════════════╝");

  let token: string;
  let createdWarehouseId: string;
  let createdHeadId: string;

  // 1. LOGIN
  section("1. Login sebagai Superadmin");
  token = await loginAsSuperadmin();

  // 2. GET LIST AWAL (sebelum create)
  section("2. GET /api/warehouses (list kosong / data sebelumnya)");
  const listBefore = await apiCall("GET", "/api/warehouses?page=1&limit=5", token);
  log(`Status: ${listBefore.status}`);
  log(`Total Record sebelum create: ${listBefore.data.meta?.pagination?.totalRecord}`);

  // 3. CREATE WAREHOUSE
  section("3. POST /api/warehouses — Create warehouse baru");
  const createRes = await apiCall("POST", "/api/warehouses", token, {
    code: "WH-TEST-001",
    name: "Gudang Test Jakarta Pusat",
    description: "Gudang untuk keperluan flow testing",
    address: "Jl. Test No. 1, Jakarta Pusat",
    province: "31",         // Kode DKI Jakarta
    cityRegency: "3171",    // Kode Jakarta Pusat
    district: "317101",     // Kode Gambir
    village: "3171010001",  // Kode Gambir (kelurahan)
    zipCode: "10110",
    latitude: -6.1751,
    longitude: 106.8272,
    isActive: true,
  });
  log(`Status: ${createRes.status}`);
  log(`Response: ${JSON.stringify(createRes.data, null, 2)}`);

  if (createRes.status !== 200) throw new Error("CREATE warehouse gagal!");
  createdWarehouseId = createRes.data.data.record.id;
  log(`✓ Warehouse dibuat dengan ID: ${createdWarehouseId}`);

  // 4. CREATE DUPLIKAT (harus gagal)
  section("4. POST /api/warehouses — Duplikat code (expected 400)");
  const dupRes = await apiCall("POST", "/api/warehouses", token, {
    code: "WH-TEST-001",
    name: "Duplikat Gudang",
  });
  log(`Status: ${dupRes.status} (expected: 400)`);
  log(`Message: ${dupRes.data.meta?.exceptionMessage}`);
  if (dupRes.status !== 400) throw new Error("Seharusnya gagal karena code duplikat!");
  log("✓ Validasi duplikat code berjalan dengan benar");

  // 5. GET BY ID
  section("5. GET /api/warehouses/:id — Get detail warehouse");
  const getRes = await apiCall("GET", `/api/warehouses/${createdWarehouseId}`, token);
  log(`Status: ${getRes.status}`);
  log(`Warehouse Name: ${getRes.data.data?.record?.name}`);
  log(`Koordinat: lat=${getRes.data.data?.record?.latitude}, lng=${getRes.data.data?.record?.longitude}`);
  log(`Kode Provinsi: ${getRes.data.data?.record?.province}`);
  if (getRes.status !== 200) throw new Error("GET by ID warehouse gagal!");
  log("✓ Detail warehouse berhasil diambil");

  // 6. GET LIST (setelah create)
  section("6. GET /api/warehouses?page=1&limit=5 — List dengan pagination");
  const listAfter = await apiCall("GET", "/api/warehouses?page=1&limit=5", token);
  log(`Status: ${listAfter.status}`);
  log(`Total Record setelah create: ${listAfter.data.meta?.pagination?.totalRecord}`);
  log(`Records di halaman ini: ${listAfter.data.data?.records?.length}`);
  log("Pagination meta: " + JSON.stringify(listAfter.data.meta?.pagination, null, 2));

  // 7. GET LIST WITH SEARCH
  section("7. GET /api/warehouses?searchTerm=Jakarta&filterColumn=name — Pencarian");
  const searchRes = await apiCall("GET", "/api/warehouses?searchTerm=Jakarta&filterColumn=name&limit=5", token);
  log(`Status: ${searchRes.status}`);
  log(`Hasil pencarian "Jakarta": ${searchRes.data.data?.records?.length} record`);

  // 8. UPDATE WAREHOUSE
  section("8. PUT /api/warehouses/:id — Update warehouse");
  const updateRes = await apiCall("PUT", `/api/warehouses/${createdWarehouseId}`, token, {
    name: "Gudang Test Jakarta Pusat (Updated)",
    description: "Deskripsi diupdate saat flow testing",
    zipCode: "10120",
  });
  log(`Status: ${updateRes.status}`);
  log(`Updated Name: ${updateRes.data.data?.record?.name}`);
  if (updateRes.status !== 200) throw new Error("UPDATE warehouse gagal!");
  log("✓ Warehouse berhasil diupdate");

  // 9. ASSIGN WAREHOUSE HEAD
  section("9. POST /api/warehouses/:id/heads — Assign kepala gudang");
  // Gunakan user superadmin sebagai kepala gudang untuk testing
  const superadmin = await UserModel.findByEmail("adminit@gmail.com");
  if (!superadmin) throw new Error("Superadmin user tidak ditemukan di DB!");

  const assignRes = await apiCall("POST", `/api/warehouses/${createdWarehouseId}/heads`, token, {
    userId: superadmin.id,
    description: "Kepala gudang untuk keperluan testing",
  });
  log(`Status: ${assignRes.status}`);
  log(`Response: ${JSON.stringify(assignRes.data, null, 2)}`);
  if (assignRes.status !== 200) throw new Error("ASSIGN warehouse head gagal!");
  createdHeadId = assignRes.data.data.record.id;
  log(`✓ Warehouse head ditambahkan dengan ID: ${createdHeadId}`);

  // 10. GET WAREHOUSE HEADS
  section("10. GET /api/warehouses/:id/heads — Daftar kepala gudang");
  const headsRes = await apiCall("GET", `/api/warehouses/${createdWarehouseId}/heads`, token);
  log(`Status: ${headsRes.status}`);
  log(`Jumlah kepala gudang: ${headsRes.data.data?.records?.length}`);
  log(`Records: ${JSON.stringify(headsRes.data.data?.records, null, 2)}`);

  // 11. UNASSIGN WAREHOUSE HEAD
  section("11. DELETE /api/warehouses/heads/:headId — Hapus kepala gudang");
  const unassignRes = await apiCall("DELETE", `/api/warehouses/heads/${createdHeadId}`, token);
  log(`Status: ${unassignRes.status}`);
  if (unassignRes.status !== 200) throw new Error("UNASSIGN warehouse head gagal!");
  log("✓ Warehouse head berhasil dihapus");

  // 12. SOFT DELETE WAREHOUSE
  section("12. DELETE /api/warehouses/:id — Soft delete warehouse");
  const deleteRes = await apiCall("DELETE", `/api/warehouses/${createdWarehouseId}`, token);
  log(`Status: ${deleteRes.status}`);
  if (deleteRes.status !== 200) throw new Error("DELETE warehouse gagal!");
  log("✓ Warehouse berhasil di-soft-delete");

  // 13. VERIFIKASI SOFT DELETE
  section("13. Verifikasi soft-delete — GET by ID (expected 400)");
  const getDeletedRes = await apiCall("GET", `/api/warehouses/${createdWarehouseId}`, token);
  log(`Status: ${getDeletedRes.status} (expected: 400 — data tidak ditemukan)`);
  if (getDeletedRes.status !== 400) throw new Error("Data seharusnya sudah ter-soft-delete!");
  log("✓ Verifikasi soft-delete berhasil — data tidak ditemukan di API");

  // Verifikasi di DB langsung bahwa data ada tapi memiliki deleted_at
  const dbCheck = await db
    .select({ id: warehouses.id, deletedAt: warehouses.deletedAt })
    .from(warehouses)
    .where(eq(warehouses.id, createdWarehouseId))
    .limit(1);
  log(`DB Check — deletedAt: ${dbCheck[0]?.deletedAt} (harus berisi timestamp)`);

  // ─── CLEANUP ─────────────────────────────────────────────────────────────────
  section("CLEANUP — Menghapus data test dari database");
  await cleanupWarehouse(createdWarehouseId);
  log("✓ Data test warehouse berhasil dihapus dari DB");

  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║     ✅ SEMUA WAREHOUSE TESTS BERHASIL!                  ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  process.exit(0);
}

runWarehouseFlowTests().catch((err) => {
  console.error("\n❌ WAREHOUSE FLOW TEST GAGAL:", err.message);
  process.exit(1);
});
