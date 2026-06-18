/**
 * Master Flow Testing: Semua Modul Master Data
 *
 * Script ini menjalankan semua flow test secara berurutan:
 * 1. Warehouse Module
 * 2. Category Module
 * 3. UOM Module
 * 4. Item Module (Single & Package)
 *
 * Jalankan dengan: bun src/flow-testing-feature/test-flow-master-data.ts
 *
 * Prasyarat:
 * - Server berjalan di http://localhost:3000
 * - Migration sudah dijalankan (`bun run db:migrate`)
 * - Seeding sudah dijalankan (`bun run db:seed`)
 */

import { eq } from "drizzle-orm";
import { db } from "../core/db";
import { warehouses, warehouseHeads } from "../modules/warehouse/warehouse.schema";
import { itemCategories } from "../modules/category/category.schema";
import { uoms } from "../modules/uom/uom.schema";
import { items, itemPackageDetails } from "../modules/item/item.schema";
import { UserModel } from "../modules/user";

const BASE_URL = "http://localhost:3000";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function log(msg: string) {
  console.log(msg);
}

function section(title: string) {
  console.log(`\n${"─".repeat(65)}`);
  console.log(`▶ ${title}`);
  console.log("─".repeat(65));
}

function moduleHeader(name: string, emoji: string) {
  const line = "═".repeat(65);
  console.log(`\n╔${line}╗`);
  console.log("║  " + emoji + "  " + name.toUpperCase().padEnd(60) + "║");
  console.log(`╚${line}╝`);
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

function assertStatus(actual: number, expected: number, context: string) {
  if (actual !== expected) {
    throw new Error(`[${context}] Expected status ${expected}, got ${actual}`);
  }
}

// ─── Login ────────────────────────────────────────────────────────────────────

async function login(): Promise<string> {
  const { status, data } = await apiCall("POST", "/api/auth/login", undefined, {
    email: "adminit@gmail.com",
    password: "12345678",
  });
  if (status !== 200 || !data.data?.record?.accessToken) {
    throw new Error(`Login gagal! Status: ${status}`);
  }
  return data.data.record.accessToken;
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

async function hardCleanup(ids: {
  warehouseIds?: string[];
  categoryIds?: string[];
  uomIds?: string[];
  itemIds?: string[];
}) {
  if (ids.warehouseIds) {
    for (const id of ids.warehouseIds) {
      await db.delete(warehouseHeads).where(eq(warehouseHeads.warehouseId, id));
      await db.delete(warehouses).where(eq(warehouses.id, id));
    }
  }
  if (ids.itemIds) {
    for (const id of ids.itemIds) {
      await db.delete(itemPackageDetails).where(eq(itemPackageDetails.packageItemId, id));
    }
    for (const id of ids.itemIds) {
      await db.delete(items).where(eq(items.id, id));
    }
  }
  if (ids.uomIds) {
    for (const id of ids.uomIds) {
      await db.delete(uoms).where(eq(uoms.id, id));
    }
  }
  if (ids.categoryIds) {
    for (const id of ids.categoryIds) {
      await db.delete(itemCategories).where(eq(itemCategories.id, id));
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 1: Warehouse
// ─────────────────────────────────────────────────────────────────────────────

async function testWarehouse(token: string): Promise<void> {
  moduleHeader("MODUL WAREHOUSE", "🏭");

  let warehouseId: string;
  let headId: string;

  // Create
  section("1.1 Create Warehouse");
  const createRes = await apiCall("POST", "/api/warehouses", token, {
    code: "WH-MASTER-TEST-001",
    name: "Gudang Master Test Surabaya",
    address: "Jl. Rungkut Industri No. 1",
    province: "35",       // Jawa Timur
    cityRegency: "3578",  // Kota Surabaya
    zipCode: "60293",
    latitude: -7.3057,
    longitude: 112.7381,
    isActive: true,
  });
  assertStatus(createRes.status, 200, "Create Warehouse");
  warehouseId = createRes.data.data.record.id;
  log(`  ✓ Created: ${createRes.data.data.record.name} (ID: ${warehouseId})`);

  // Duplicate check
  const dupRes = await apiCall("POST", "/api/warehouses", token, { code: "WH-MASTER-TEST-001", name: "Dup" });
  assertStatus(dupRes.status, 400, "Duplicate Warehouse Code");
  log(`  ✓ Duplikat code ditolak dengan benar`);

  // List + pagination
  section("1.2 List & Pagination Warehouse");
  const listRes = await apiCall("GET", "/api/warehouses?page=1&limit=3", token);
  assertStatus(listRes.status, 200, "List Warehouse");
  log(`  ✓ Total record: ${listRes.data.meta?.pagination?.totalRecord}`);
  log(`  ✓ nextPage: ${listRes.data.meta?.pagination?.nextPage}`);

  // Search
  const searchRes = await apiCall("GET", "/api/warehouses?searchTerm=Surabaya&filterColumn=name", token);
  assertStatus(searchRes.status, 200, "Search Warehouse");
  log(`  ✓ Search "Surabaya": ${searchRes.data.data?.records?.length} hasil`);

  // Get by ID
  section("1.3 Get Detail Warehouse");
  const getRes = await apiCall("GET", `/api/warehouses/${warehouseId}`, token);
  assertStatus(getRes.status, 200, "Get Warehouse by ID");
  log(`  ✓ Detail: ${getRes.data.data?.record?.name}, Provinsi: ${getRes.data.data?.record?.province}`);

  // Update
  section("1.4 Update Warehouse");
  const updateRes = await apiCall("PUT", `/api/warehouses/${warehouseId}`, token, {
    name: "Gudang Master Test Surabaya Timur",
    zipCode: "60294",
  });
  assertStatus(updateRes.status, 200, "Update Warehouse");
  log(`  ✓ Updated name: ${updateRes.data.data?.record?.name}`);

  // Assign Head
  section("1.5 Assign & Unassign Warehouse Head");
  const superadmin = await UserModel.findByEmail("adminit@gmail.com");
  if (!superadmin) throw new Error("Superadmin tidak ditemukan!");

  const assignRes = await apiCall("POST", `/api/warehouses/${warehouseId}/heads`, token, {
    userId: superadmin.id,
    description: "Kepala gudang sementara untuk testing",
  });
  assertStatus(assignRes.status, 200, "Assign Warehouse Head");
  headId = assignRes.data.data.record.id;
  log(`  ✓ Head assigned: ID ${headId}`);

  const getHeadsRes = await apiCall("GET", `/api/warehouses/${warehouseId}/heads`, token);
  assertStatus(getHeadsRes.status, 200, "Get Warehouse Heads");
  log(`  ✓ Jumlah kepala gudang: ${getHeadsRes.data.data?.records?.length}`);

  const unassignRes = await apiCall("DELETE", `/api/warehouses/heads/${headId}`, token);
  assertStatus(unassignRes.status, 200, "Unassign Warehouse Head");
  log(`  ✓ Head unassigned`);

  // Soft delete
  section("1.6 Soft Delete Warehouse");
  const deleteRes = await apiCall("DELETE", `/api/warehouses/${warehouseId}`, token);
  assertStatus(deleteRes.status, 200, "Delete Warehouse");
  log(`  ✓ Soft-deleted`);

  const getDeletedRes = await apiCall("GET", `/api/warehouses/${warehouseId}`, token);
  assertStatus(getDeletedRes.status, 400, "Verify Soft Delete Warehouse");
  log(`  ✓ Verifikasi soft-delete: data tidak muncul di API`);

  // Cleanup
  await hardCleanup({ warehouseIds: [warehouseId] });
  log(`  ✓ Hard cleanup selesai`);

  console.log("\n  ✅ MODULE WAREHOUSE: SEMUA TEST BERHASIL!\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 2: Category
// ─────────────────────────────────────────────────────────────────────────────

async function testCategory(token: string): Promise<{ categoryId: string }> {
  moduleHeader("MODUL CATEGORY", "📂");

  let categoryId: string;

  section("2.1 Create Category");
  const createRes = await apiCall("POST", "/api/categories", token, {
    code: "CAT-MASTER-TEST-001",
    name: "Elektronik Master Test",
    description: "Category untuk master flow testing",
    isActive: true,
  });
  assertStatus(createRes.status, 200, "Create Category");
  categoryId = createRes.data.data.record.id;
  log(`  ✓ Created: ${createRes.data.data.record.name}, Code: ${createRes.data.data.record.code}`);

  assertStatus(
    (await apiCall("POST", "/api/categories", token, { code: "CAT-MASTER-TEST-001", name: "Dup" })).status,
    400, "Duplicate Category Code"
  );
  log(`  ✓ Duplikat code ditolak`);

  section("2.2 List & Search Category");
  const listRes = await apiCall("GET", "/api/categories?page=1&limit=5", token);
  assertStatus(listRes.status, 200, "List Category");
  log(`  ✓ Total: ${listRes.data.meta?.pagination?.totalRecord}`);

  const searchRes = await apiCall("GET", "/api/categories?searchTerm=Master&filterColumn=name", token);
  assertStatus(searchRes.status, 200, "Search Category");
  log(`  ✓ Search "Master": ${searchRes.data.data?.records?.length} hasil`);

  section("2.3 Update Category");
  const updateRes = await apiCall("PUT", `/api/categories/${categoryId}`, token, {
    name: "Elektronik Master Test (Updated)",
    isActive: false,
  });
  assertStatus(updateRes.status, 200, "Update Category");
  log(`  ✓ Updated: ${updateRes.data.data?.record?.name}, isActive: ${updateRes.data.data?.record?.isActive}`);

  console.log("\n  ✅ MODULE CATEGORY: SEMUA TEST BERHASIL! (ID akan dipakai modul Item)\n");
  return { categoryId };
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 3: UOM
// ─────────────────────────────────────────────────────────────────────────────

async function testUom(token: string): Promise<{ uomId: string }> {
  moduleHeader("MODUL UOM", "📏");

  let uomId: string;

  section("3.1 Create UOM");
  const createRes = await apiCall("POST", "/api/uoms", token, {
    code: "UOM-MASTER-TEST-PCS",
    name: "Pieces Master Test",
    description: "UOM untuk master flow testing",
    isActive: true,
  });
  assertStatus(createRes.status, 200, "Create UOM");
  uomId = createRes.data.data.record.id;
  log(`  ✓ Created: ${createRes.data.data.record.name}, Code: ${createRes.data.data.record.code}`);

  assertStatus(
    (await apiCall("POST", "/api/uoms", token, { code: "UOM-MASTER-TEST-PCS", name: "Dup" })).status,
    400, "Duplicate UOM Code"
  );
  log(`  ✓ Duplikat code ditolak`);

  section("3.2 List, Pagination & Sort UOM");
  const listRes = await apiCall("GET", "/api/uoms?page=1&limit=5", token);
  assertStatus(listRes.status, 200, "List UOM");
  log(`  ✓ Total: ${listRes.data.meta?.pagination?.totalRecord}`);

  const sortRes = await apiCall("GET", `/api/uoms?orderBy=${encodeURIComponent("{'Name':'ASC'}")}`, token);
  assertStatus(sortRes.status, 200, "Sort UOM");
  const names = sortRes.data.data?.records?.map((r: any) => r.name) ?? [];
  log(`  ✓ Sorted ASC by Name: [${names.slice(0, 3).join(", ")}...]`);

  section("3.3 Update UOM");
  const updateRes = await apiCall("PUT", `/api/uoms/${uomId}`, token, {
    name: "Pieces Master Test (Updated)",
  });
  assertStatus(updateRes.status, 200, "Update UOM");
  log(`  ✓ Updated: ${updateRes.data.data?.record?.name}`);

  console.log("\n  ✅ MODULE UOM: SEMUA TEST BERHASIL! (ID akan dipakai modul Item)\n");
  return { uomId };
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 4: Item (Single & Package) + Guard Tests
// ─────────────────────────────────────────────────────────────────────────────

async function testItem(
  token: string,
  uomId: string,
  categoryId: string
): Promise<{ itemIds: string[] }> {
  moduleHeader("MODUL ITEM (SINGLE & PACKAGE)", "📦");

  const allItemIds: string[] = [];

  // ── Single Item ──────────────────────────────────────────────────────────────

  section("4.1 Create Item Single");
  const s1 = await apiCall("POST", "/api/items", token, {
    code: "ITEM-MASTER-SINGLE-001",
    name: "Charger USB-C Master Test",
    uomId, categoryId,
    itemType: "single",
    purchasePrice: 30000,
    sellingPrice: 50000,
  });
  assertStatus(s1.status, 200, "Create Single Item 1");
  const singleId1 = s1.data.data.record.id;
  allItemIds.push(singleId1);
  log(`  ✓ Item single 1: ${s1.data.data.record.name} (ID: ${singleId1})`);

  const s2 = await apiCall("POST", "/api/items", token, {
    code: "ITEM-MASTER-SINGLE-002",
    name: "Kabel Data USB-C Master Test",
    uomId, categoryId,
    itemType: "single",
    purchasePrice: 15000,
    sellingPrice: 25000,
  });
  assertStatus(s2.status, 200, "Create Single Item 2");
  const singleId2 = s2.data.data.record.id;
  allItemIds.push(singleId2);
  log(`  ✓ Item single 2: ${s2.data.data.record.name} (ID: ${singleId2})`);

  section("4.2 List & Filter Item Single");
  const listSingle = await apiCall("GET", "/api/items?itemType=single&page=1&limit=5", token);
  assertStatus(listSingle.status, 200, "List Single Items");
  log(`  ✓ Total item single: ${listSingle.data.meta?.pagination?.totalRecord}`);

  const searchItem = await apiCall("GET", "/api/items?searchTerm=Charger&filterColumn=name", token);
  assertStatus(searchItem.status, 200, "Search Item");
  log(`  ✓ Search "Charger": ${searchItem.data.data?.records?.length} hasil`);

  section("4.3 Update Item Single");
  const updateSingle = await apiCall("PUT", `/api/items/${singleId1}`, token, {
    sellingPrice: 55000,
    name: "Charger USB-C Master Test (Updated)",
  });
  assertStatus(updateSingle.status, 200, "Update Single Item");
  log(`  ✓ Updated sellingPrice: ${updateSingle.data.data?.record?.sellingPrice}`);

  // ── Package Item ─────────────────────────────────────────────────────────────

  section("4.4 Create Item Package");
  const p1 = await apiCall("POST", "/api/items", token, {
    code: "ITEM-MASTER-PKG-001",
    name: "Paket Charger Komplit Master Test",
    uomId, categoryId,
    itemType: "package",
    purchasePrice: 45000,
    sellingPrice: 70000,
    discountPercentage: 5,  // 5% → discountPrice=3500, priceAfter=66500
    details: [
      { childItemId: singleId1, quantity: 1, price: 50000, discountPercentage: 0 },
      { childItemId: singleId2, quantity: 1, price: 23000, discountPercentage: 4 }, // 4% diskon
    ],
  });
  assertStatus(p1.status, 200, "Create Package Item");
  const packageId = p1.data.data.record.id;
  allItemIds.push(packageId);
  const pkg = p1.data.data.record;
  log(`  ✓ Package created: ${pkg.name}`);
  log(`  ✓ sellingPrice: ${pkg.sellingPrice}`);
  log(`  ✓ discountPrice: ${pkg.discountPrice} (expected: ${(70000 * 5 / 100).toFixed(2)})`);
  log(`  ✓ priceAfterDiscount: ${pkg.priceAfterDiscount} (expected: ${(70000 * 0.95).toFixed(2)})`);
  log(`  ✓ jumlah detail: ${pkg.details?.length} (expected: 2)`);

  // Verifikasi kalkulasi diskon
  const expectedDiscount = (70000 * 5 / 100).toFixed(2);
  const expectedAfter = (70000 * 0.95).toFixed(2);
  if (pkg.discountPrice !== expectedDiscount) throw new Error(`discountPrice salah: ${pkg.discountPrice} vs ${expectedDiscount}`);
  if (pkg.priceAfterDiscount !== expectedAfter) throw new Error(`priceAfterDiscount salah: ${pkg.priceAfterDiscount} vs ${expectedAfter}`);
  log(`  ✓ Kalkulasi diskon otomatis BENAR!`);

  section("4.5 Validasi Package — Guard Tests");

  // Package tanpa details
  const noDetailRes = await apiCall("POST", "/api/items", token, {
    code: "ITEM-MASTER-PKG-NODETAIL",
    name: "Package Tanpa Detail",
    uomId, categoryId, itemType: "package", sellingPrice: 10000, details: [],
  });
  assertStatus(noDetailRes.status, 400, "Package Without Details");
  log(`  ✓ Package tanpa details ditolak: ${noDetailRes.data.meta?.exceptionMessage}`);

  // Child item tidak ada
  const invalidChildRes = await apiCall("POST", "/api/items", token, {
    code: "ITEM-MASTER-PKG-INVALID",
    name: "Package Invalid Child",
    uomId, categoryId, itemType: "package", sellingPrice: 10000,
    details: [{ childItemId: "00000000-0000-0000-0000-000000000001", quantity: 1, price: 5000, discountPercentage: 0 }],
  });
  assertStatus(invalidChildRes.status, 400, "Package With Invalid Child");
  log(`  ✓ Package dengan child tidak valid ditolak`);

  section("4.6 Get Detail Package (with details field)");
  const getPkg = await apiCall("GET", `/api/items/${packageId}`, token);
  assertStatus(getPkg.status, 200, "Get Package Detail");
  log(`  ✓ itemType: ${getPkg.data.data?.record?.itemType}`);
  log(`  ✓ details count: ${getPkg.data.data?.record?.details?.length}`);
  if (getPkg.data.data?.record?.details?.length !== 2) throw new Error("Package harus ada 2 detail!");

  section("4.7 Soft Delete Items");
  for (const id of [singleId1, singleId2, packageId]) {
    const delRes = await apiCall("DELETE", `/api/items/${id}`, token);
    assertStatus(delRes.status, 200, `Delete Item ${id}`);
    log(`  ✓ Soft-deleted item: ${id}`);
  }

  // ── Guard: UOM & Category yang masih dipakai ─────────────────────────────────

  section("4.8 Guard — Hapus UOM & Category yang masih dipakai item lain");

  // Buat item yang masih aktif menggunakan UOM dan Category yang sama
  const guardItemRes = await apiCall("POST", "/api/items", token, {
    code: "ITEM-MASTER-GUARD-001",
    name: "Item Guard Master",
    uomId, categoryId, itemType: "single",
    purchasePrice: 5000, sellingPrice: 10000,
  });
  assertStatus(guardItemRes.status, 200, "Create Guard Item");
  const guardItemId = guardItemRes.data.data.record.id;
  allItemIds.push(guardItemId);

  const delUomGuard = await apiCall("DELETE", `/api/uoms/${uomId}`, token);
  assertStatus(delUomGuard.status, 400, "Delete UOM In Use");
  log(`  ✓ Delete UOM yang dipakai item ditolak: ${delUomGuard.data.meta?.exceptionMessage}`);

  const delCatGuard = await apiCall("DELETE", `/api/categories/${categoryId}`, token);
  assertStatus(delCatGuard.status, 400, "Delete Category In Use");
  log(`  ✓ Delete Category yang dipakai item ditolak: ${delCatGuard.data.meta?.exceptionMessage}`);

  console.log("\n  ✅ MODULE ITEM (SINGLE & PACKAGE): SEMUA TEST BERHASIL!\n");
  return { itemIds: allItemIds };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN RUNNER
// ─────────────────────────────────────────────────────────────────────────────

async function runAllMasterDataTests() {
  const startTime = Date.now();

  console.log("╔═══════════════════════════════════════════════════════════════════╗");
  console.log("║          MASTER FLOW TESTING: SEMUA MODUL MASTER DATA            ║");
  console.log("║  Warehouse | Category | UOM | Item (Single & Package)            ║");
  console.log("╚═══════════════════════════════════════════════════════════════════╝");
  console.log(`\nStarted at: ${new Date().toLocaleString("id-ID")}`);

  // LOGIN DULU
  section("🔐 Login sebagai Superadmin");
  const token = await login();
  log(`✓ Token diperoleh`);

  const results: Record<string, "PASS" | "FAIL"> = {};
  let categoryId = "";
  let uomId = "";
  let allItemIds: string[] = [];

  // ── MODULE 1: Warehouse ──────────────────────────────────────────────────────
  try {
    await testWarehouse(token);
    results["Warehouse"] = "PASS";
  } catch (err: any) {
    results["Warehouse"] = "FAIL";
    console.error(`\n❌ WAREHOUSE TEST GAGAL: ${err.message}`);
  }

  // ── MODULE 2: Category ───────────────────────────────────────────────────────
  try {
    const catResult = await testCategory(token);
    categoryId = catResult.categoryId;
    results["Category"] = "PASS";
  } catch (err: any) {
    results["Category"] = "FAIL";
    console.error(`\n❌ CATEGORY TEST GAGAL: ${err.message}`);
  }

  // ── MODULE 3: UOM ────────────────────────────────────────────────────────────
  try {
    const uomResult = await testUom(token);
    uomId = uomResult.uomId;
    results["UOM"] = "PASS";
  } catch (err: any) {
    results["UOM"] = "FAIL";
    console.error(`\n❌ UOM TEST GAGAL: ${err.message}`);
  }

  // ── MODULE 4: Item ───────────────────────────────────────────────────────────
  if (uomId && categoryId) {
    try {
      const itemResult = await testItem(token, uomId, categoryId);
      allItemIds = itemResult.itemIds;
      results["Item"] = "PASS";
    } catch (err: any) {
      results["Item"] = "FAIL";
      console.error(`\n❌ ITEM TEST GAGAL: ${err.message}`);
    }
  } else {
    results["Item"] = "FAIL";
    log("\n⚠ Item test dilewati karena UOM/Category tidak berhasil dibuat");
  }

  // ── FINAL CLEANUP ────────────────────────────────────────────────────────────
  section("🧹 FINAL CLEANUP — Hapus semua data test dari DB");
  await hardCleanup({
    itemIds: allItemIds,
    uomIds: uomId ? [uomId] : [],
    categoryIds: categoryId ? [categoryId] : [],
  });
  log("✓ Semua data test telah dihapus dari database");

  // ── LAPORAN HASIL ────────────────────────────────────────────────────────────

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log("\n");
  console.log("╔═══════════════════════════════════════════════════════════════════╗");
  console.log("║                      LAPORAN HASIL TESTING                       ║");
  console.log("╠═══════════════════════════════════════════════════════════════════╣");

  const allPassed = Object.values(results).every((r) => r === "PASS");

  for (const [module, result] of Object.entries(results)) {
    const icon = result === "PASS" ? "✅" : "❌";
    const padded = `  ${icon}  ${module}`.padEnd(67);
    console.log(`║${padded}║`);
  }

  console.log("╠═══════════════════════════════════════════════════════════════════╣");
  const summary = allPassed ? "✅  SEMUA TEST BERHASIL!" : "❌  ADA TEST YANG GAGAL!";
  console.log(`║  ${summary.padEnd(65)}║`);
  console.log(`║  Durasi: ${elapsed}s`.padEnd(68) + "║");
  console.log("╚═══════════════════════════════════════════════════════════════════╝");

  process.exit(allPassed ? 0 : 1);
}

runAllMasterDataTests().catch((err) => {
  console.error("\n💥 MASTER TEST RUNNER CRASHED:", err.message);
  process.exit(1);
});
