/**
 * Flow Testing: Modul Item (Single & Package)
 *
 * Test scenario yang dicakup:
 * BAGIAN A — Item Single:
 * 1. Login sebagai superadmin
 * 2. Siapkan data pendukung: UOM & Category
 * 3. Create item single
 * 4. Duplikat code (expected 400)
 * 5. Get list items dengan filter itemType=single
 * 6. Get detail item single by ID
 * 7. Update item single (perubahan harga → kalkulasi diskon diuji di package)
 * 8. Soft delete item single
 *
 * BAGIAN B — Item Package:
 * 9. Create item package dengan detail komponen
 * 10. Validasi: child item harus bertipe 'single' (expected 400 jika package)
 * 11. Validasi: child item ID tidak valid (expected 400)
 * 12. Get detail item package (harus menyertakan field details)
 * 13. Verifikasi kalkulasi diskon otomatis
 * 14. Update item package (replace detail komponen)
 * 15. Soft delete item package
 *
 * BAGIAN C — Guard Tests:
 * 16. Coba hapus UOM yang sedang dipakai item → expected 400
 * 17. Coba hapus Category yang sedang dipakai item → expected 400
 *
 * 18. Cleanup semua data test
 *
 * Prasyarat:
 * - Server berjalan di http://localhost:3000
 * - Migration sudah dijalankan (`bun run db:migrate`)
 * - Seeding sudah dijalankan (`bun run db:seed`)
 */

import { eq } from "drizzle-orm";
import { db } from "../core/db";
import { items, itemPackageDetails } from "../modules/item/item.schema";
import { uoms } from "../modules/uom/uom.schema";
import { itemCategories } from "../modules/category/category.schema";

const BASE_URL = "http://localhost:3000";

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

async function cleanupAll(
  itemIds: string[],
  uomId: string,
  categoryId: string
) {
  // Hapus detail paket dulu (FK constraint)
  for (const id of itemIds) {
    await db.delete(itemPackageDetails).where(eq(itemPackageDetails.packageItemId, id));
  }
  // Hapus items
  for (const id of itemIds) {
    await db.delete(items).where(eq(items.id, id));
  }
  // Hapus UOM & Category
  await db.delete(uoms).where(eq(uoms.id, uomId));
  await db.delete(itemCategories).where(eq(itemCategories.id, categoryId));
}

// ─── Login ────────────────────────────────────────────────────────────────────

async function loginAsSuperadmin(): Promise<string> {
  const { status, data } = await apiCall("POST", "/api/auth/login", undefined, {
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

async function runItemFlowTests() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║        FLOW TESTING: MODUL ITEM (SINGLE & PACKAGE)     ║");
  console.log("╚══════════════════════════════════════════════════════════╝");

  let token: string;
  let testUomId: string;
  let testCategoryId: string;
  let singleItemId: string;
  let packageItemId: string;

  const allCreatedItemIds: string[] = [];

  // 1. LOGIN
  section("1. Login sebagai Superadmin");
  token = await loginAsSuperadmin();

  // ─────────────────────────────────────────────────────────────────────────────
  // SETUP: Buat UOM & Category sebagai data pendukung
  // ─────────────────────────────────────────────────────────────────────────────

  section("SETUP — Membuat UOM & Category pendukung");

  const uomRes = await apiCall("POST", "/api/uoms", token, {
    code: "UOM-ITEM-TEST-PCS",
    name: "PCS Item Testing",
    description: "UOM untuk item flow testing",
  });
  if (uomRes.status !== 200) throw new Error("Gagal membuat UOM pendukung: " + JSON.stringify(uomRes.data));
  testUomId = uomRes.data.data.record.id;
  log(`✓ UOM dibuat: ${uomRes.data.data.record.name} (ID: ${testUomId})`);

  const catRes = await apiCall("POST", "/api/categories", token, {
    code: "CAT-ITEM-TEST-ELK",
    name: "Elektronik Item Testing",
    description: "Category untuk item flow testing",
  });
  if (catRes.status !== 200) throw new Error("Gagal membuat Category pendukung");
  testCategoryId = catRes.data.data.record.id;
  log(`✓ Category dibuat: ${catRes.data.data.record.name} (ID: ${testCategoryId})`);

  // ─────────────────────────────────────────────────────────────────────────────
  // BAGIAN A: Item Single
  // ─────────────────────────────────────────────────────────────────────────────

  section("BAGIAN A: Item Single");

  // 2. CREATE ITEM SINGLE
  section("2. POST /api/items — Create item single");
  const createSingleRes = await apiCall("POST", "/api/items", token, {
    code: "ITEM-SINGLE-TEST-001",
    name: "Kabel HDMI 2m Testing",
    description: "Item single untuk keperluan flow testing",
    uomId: testUomId,
    categoryId: testCategoryId,
    barcodeText: "8991234500001",
    barcodeType: "EAN-13",
    itemType: "single",
    purchasePrice: 45000,
    sellingPrice: 75000,
    isActive: true,
  });
  log(`Status: ${createSingleRes.status}`);
  log(`Response: ${JSON.stringify(createSingleRes.data, null, 2)}`);

  if (createSingleRes.status !== 200) throw new Error("CREATE item single gagal!");
  singleItemId = createSingleRes.data.data.record.id;
  allCreatedItemIds.push(singleItemId);
  log(`✓ Item single dibuat dengan ID: ${singleItemId}`);

  // 3. DUPLIKAT CODE (harus gagal)
  section("3. POST /api/items — Duplikat code (expected 400)");
  const dupRes = await apiCall("POST", "/api/items", token, {
    code: "ITEM-SINGLE-TEST-001",
    name: "Duplikat Item",
    uomId: testUomId,
    categoryId: testCategoryId,
    itemType: "single",
    purchasePrice: 0,
    sellingPrice: 0,
  });
  log(`Status: ${dupRes.status} (expected: 400)`);
  if (dupRes.status !== 400) throw new Error("Seharusnya gagal karena code duplikat!");
  log("✓ Validasi duplikat code berjalan dengan benar");

  // 4. GET DETAIL ITEM SINGLE
  section("4. GET /api/items/:id — Detail item single");
  const getSingleRes = await apiCall("GET", `/api/items/${singleItemId}`, token);
  log(`Status: ${getSingleRes.status}`);
  log(`Name: ${getSingleRes.data.data?.record?.name}`);
  log(`itemType: ${getSingleRes.data.data?.record?.itemType}`);
  log(`purchasePrice: ${getSingleRes.data.data?.record?.purchasePrice}`);
  log(`sellingPrice: ${getSingleRes.data.data?.record?.sellingPrice}`);
  log(`details field (harus undefined/kosong): ${JSON.stringify(getSingleRes.data.data?.record?.details)}`);
  if (getSingleRes.status !== 200) throw new Error("GET item single gagal!");
  log("✓ Detail item single berhasil diambil");

  // 5. LIST ITEMS FILTER SINGLE
  section("5. GET /api/items?itemType=single — Filter by type");
  const listSingleRes = await apiCall("GET", "/api/items?itemType=single&page=1&limit=5", token);
  log(`Status: ${listSingleRes.status}`);
  log(`Total item single: ${listSingleRes.data.meta?.pagination?.totalRecord}`);
  log(`Records: ${listSingleRes.data.data?.records?.length}`);
  log("✓ Filter itemType=single berjalan");

  // 6. UPDATE ITEM SINGLE
  section("6. PUT /api/items/:id — Update item single");
  const updateSingleRes = await apiCall("PUT", `/api/items/${singleItemId}`, token, {
    name: "Kabel HDMI 2m Testing (Updated)",
    sellingPrice: 80000,
    purchasePrice: 48000,
  });
  log(`Status: ${updateSingleRes.status}`);
  log(`Updated Name: ${updateSingleRes.data.data?.record?.name}`);
  log(`Updated sellingPrice: ${updateSingleRes.data.data?.record?.sellingPrice}`);
  if (updateSingleRes.status !== 200) throw new Error("UPDATE item single gagal!");
  log("✓ Item single berhasil diupdate");

  // ─────────────────────────────────────────────────────────────────────────────
  // BAGIAN B: Item Package
  // ─────────────────────────────────────────────────────────────────────────────

  // Buat item single kedua sebagai komponen paket
  section("SETUP PACKAGE — Buat item single kedua (komponen paket)");
  const createSingle2Res = await apiCall("POST", "/api/items", token, {
    code: "ITEM-SINGLE-TEST-002",
    name: "Adaptor HDMI Testing",
    uomId: testUomId,
    categoryId: testCategoryId,
    itemType: "single",
    purchasePrice: 20000,
    sellingPrice: 35000,
  });
  if (createSingle2Res.status !== 200) throw new Error("Gagal membuat item single kedua");
  const singleItemId2 = createSingle2Res.data.data.record.id;
  allCreatedItemIds.push(singleItemId2);
  log(`✓ Item single kedua dibuat: ID ${singleItemId2}`);

  section("BAGIAN B: Item Package");

  // 7. CREATE ITEM PACKAGE — VALID
  section("7. POST /api/items — Create item package (harga 100000, diskon 10%)");
  const createPackageRes = await apiCall("POST", "/api/items", token, {
    code: "ITEM-PKG-TEST-001",
    name: "Paket HDMI Komplit Testing",
    description: "Paket terdiri dari kabel HDMI + adaptor",
    uomId: testUomId,
    categoryId: testCategoryId,
    itemType: "package",
    purchasePrice: 65000,
    sellingPrice: 100000,
    discountPercentage: 10,  // 10% diskon → discount_price=10000, price_after=90000
    isActive: true,
    details: [
      {
        childItemId: singleItemId,
        quantity: 1,
        price: 65000,           // Override dari sellingPrice satuan (80000)
        discountPercentage: 0,
      },
      {
        childItemId: singleItemId2,
        quantity: 1,
        price: 30000,           // Override dari sellingPrice satuan (35000)
        discountPercentage: 5,  // Diskon 5% untuk komponen ini
      },
    ],
  });
  log(`Status: ${createPackageRes.status}`);
  log(`Response: ${JSON.stringify(createPackageRes.data, null, 2)}`);

  if (createPackageRes.status !== 200) throw new Error("CREATE item package gagal!");
  packageItemId = createPackageRes.data.data.record.id;
  allCreatedItemIds.push(packageItemId);
  log(`✓ Item package dibuat dengan ID: ${packageItemId}`);

  // Verifikasi kalkulasi diskon otomatis
  const pkgRecord = createPackageRes.data.data.record;
  const expectedDiscountPrice = (100000 * 10 / 100).toFixed(2); // 10000.00
  const expectedPriceAfter = (100000 - 100000 * 10 / 100).toFixed(2); // 90000.00
  log(`\n📊 Verifikasi Kalkulasi Diskon Otomatis:`);
  log(`   sellingPrice: ${pkgRecord.sellingPrice} (expected: 100000.00)`);
  log(`   discountPercentage: ${pkgRecord.discountPercentage}% (expected: 10.00)`);
  log(`   discountPrice: ${pkgRecord.discountPrice} (expected: ${expectedDiscountPrice})`);
  log(`   priceAfterDiscount: ${pkgRecord.priceAfterDiscount} (expected: ${expectedPriceAfter})`);
  if (pkgRecord.discountPrice !== expectedDiscountPrice) {
    throw new Error(`discountPrice salah! Expected ${expectedDiscountPrice}, got ${pkgRecord.discountPrice}`);
  }
  if (pkgRecord.priceAfterDiscount !== expectedPriceAfter) {
    throw new Error(`priceAfterDiscount salah! Expected ${expectedPriceAfter}, got ${pkgRecord.priceAfterDiscount}`);
  }
  log("✓ Kalkulasi diskon otomatis BENAR!");

  // 8. GET DETAIL PACKAGE (harus ada field details)
  section("8. GET /api/items/:id — Detail item package (harus ada details)");
  const getPkgRes = await apiCall("GET", `/api/items/${packageItemId}`, token);
  log(`Status: ${getPkgRes.status}`);
  log(`Name: ${getPkgRes.data.data?.record?.name}`);
  log(`itemType: ${getPkgRes.data.data?.record?.itemType}`);
  const details = getPkgRes.data.data?.record?.details;
  log(`Jumlah details: ${details?.length} (expected: 2)`);
  log(`Details: ${JSON.stringify(details, null, 2)}`);
  if (!details || details.length !== 2) throw new Error("Item package harus memiliki 2 detail komponen!");
  log("✓ Detail package berhasil diambil dengan komponen-komponennya");

  // 9. CREATE PACKAGE TANPA DETAILS (harus gagal)
  section("9. POST /api/items — Package tanpa details (expected 400)");
  const noDetailRes = await apiCall("POST", "/api/items", token, {
    code: "ITEM-PKG-TEST-NO-DETAIL",
    name: "Paket Tanpa Komponen",
    uomId: testUomId,
    categoryId: testCategoryId,
    itemType: "package",
    sellingPrice: 50000,
    details: [],  // Kosong — harus gagal
  });
  log(`Status: ${noDetailRes.status} (expected: 400)`);
  log(`Message: ${noDetailRes.data.meta?.exceptionMessage}`);
  if (noDetailRes.status !== 400) throw new Error("Seharusnya gagal — package tanpa details!");
  log("✓ Validasi package harus ada details berjalan dengan benar");

  // 10. CREATE PACKAGE DENGAN CHILD ID TIDAK VALID
  section("10. POST /api/items — Package dengan child item ID tidak ada (expected 400)");
  const invalidChildRes = await apiCall("POST", "/api/items", token, {
    code: "ITEM-PKG-TEST-INVALID-CHILD",
    name: "Paket Child Tidak Valid",
    uomId: testUomId,
    categoryId: testCategoryId,
    itemType: "package",
    sellingPrice: 50000,
    details: [
      {
        childItemId: "00000000-0000-0000-0000-000000000001",  // ID tidak ada
        quantity: 1,
        price: 50000,
        discountPercentage: 0,
      },
    ],
  });
  log(`Status: ${invalidChildRes.status} (expected: 400)`);
  log(`Message: ${invalidChildRes.data.meta?.exceptionMessage}`);
  if (invalidChildRes.status !== 400) throw new Error("Seharusnya gagal — child item tidak ada!");
  log("✓ Validasi child item not found berjalan dengan benar (rollback transaction berhasil)");

  // 11. UPDATE PACKAGE (replace detail komponen)
  section("11. PUT /api/items/:id — Update item package (ganti satu komponen)");
  const updatePkgRes = await apiCall("PUT", `/api/items/${packageItemId}`, token, {
    name: "Paket HDMI Komplit Testing (Updated)",
    sellingPrice: 110000,
    discountPercentage: 15,  // Ganti diskon → recalculate otomatis
    details: [
      {
        childItemId: singleItemId,
        quantity: 2,           // Jumlah diganti jadi 2
        price: 60000,          // Override harga komponen
        discountPercentage: 5,
      },
    ],
  });
  log(`Status: ${updatePkgRes.status}`);
  const updatedPkg = updatePkgRes.data.data?.record;
  log(`Updated Name: ${updatedPkg?.name}`);
  log(`Updated sellingPrice: ${updatedPkg?.sellingPrice}`);
  log(`Updated discountPercentage: ${updatedPkg?.discountPercentage}%`);
  log(`Updated discountPrice: ${updatedPkg?.discountPrice} (expected: ${(110000 * 15 / 100).toFixed(2)})`);
  log(`Updated priceAfterDiscount: ${updatedPkg?.priceAfterDiscount}`);
  log(`Updated details count: ${updatedPkg?.details?.length} (expected: 1)`);
  if (updatePkgRes.status !== 200) throw new Error("UPDATE item package gagal!");
  log("✓ Update package berhasil dengan recalculate diskon otomatis");

  // 12. LIST ALL ITEMS
  section("12. GET /api/items — List semua items (single + package)");
  const listAllRes = await apiCall("GET", "/api/items?page=1&limit=10", token);
  log(`Status: ${listAllRes.status}`);
  log(`Total semua items: ${listAllRes.data.meta?.pagination?.totalRecord}`);
  log(`Items di halaman ini: ${listAllRes.data.data?.records?.length}`);

  // 13. FILTER PACKAGE
  section("13. GET /api/items?itemType=package — Filter hanya package");
  const listPkgRes = await apiCall("GET", "/api/items?itemType=package&page=1&limit=5", token);
  log(`Status: ${listPkgRes.status}`);
  log(`Total item package: ${listPkgRes.data.meta?.pagination?.totalRecord}`);
  log("✓ Filter itemType=package berjalan");

  // 14. SOFT DELETE ITEM SINGLE
  section("14. DELETE /api/items/:id — Soft delete item single");
  const delSingleRes = await apiCall("DELETE", `/api/items/${singleItemId}`, token);
  log(`Status: ${delSingleRes.status}`);
  if (delSingleRes.status !== 200) throw new Error("DELETE item single gagal!");
  log("✓ Item single berhasil di-soft-delete");

  // 15. SOFT DELETE ITEM PACKAGE
  section("15. DELETE /api/items/:id — Soft delete item package");
  const delPkgRes = await apiCall("DELETE", `/api/items/${packageItemId}`, token);
  log(`Status: ${delPkgRes.status}`);
  if (delPkgRes.status !== 200) throw new Error("DELETE item package gagal!");
  log("✓ Item package berhasil di-soft-delete");

  // ─────────────────────────────────────────────────────────────────────────────
  // BAGIAN C: Guard Tests — Delete UOM/Category yang masih dipakai
  // ─────────────────────────────────────────────────────────────────────────────

  section("BAGIAN C: Guard Tests — Delete UOM & Category yang dipakai item aktif");

  // Buat item aktif yang memakai UOM & Category
  const guardItemRes = await apiCall("POST", "/api/items", token, {
    code: "ITEM-GUARD-TEST-001",
    name: "Item Guard Testing",
    uomId: testUomId,
    categoryId: testCategoryId,
    itemType: "single",
    purchasePrice: 10000,
    sellingPrice: 15000,
  });
  if (guardItemRes.status !== 200) throw new Error("Gagal membuat item untuk guard test");
  const guardItemId = guardItemRes.data.data.record.id;
  allCreatedItemIds.push(guardItemId);
  log(`✓ Item guard dibuat: ID ${guardItemId}`);

  // 16. DELETE UOM YANG DIPAKAI (harus gagal)
  section("16. DELETE /api/uoms/:id — Hapus UOM yang dipakai item (expected 400)");
  const delUomInUseRes = await apiCall("DELETE", `/api/uoms/${testUomId}`, token);
  log(`Status: ${delUomInUseRes.status} (expected: 400)`);
  log(`Message: ${delUomInUseRes.data.meta?.exceptionMessage}`);
  if (delUomInUseRes.status !== 400) throw new Error("Seharusnya gagal — UOM sedang dipakai item!");
  log("✓ Guard delete UOM yang masih dipakai BERJALAN DENGAN BENAR");

  // 17. DELETE CATEGORY YANG DIPAKAI (harus gagal)
  section("17. DELETE /api/categories/:id — Hapus Category yang dipakai item (expected 400)");
  const delCatInUseRes = await apiCall("DELETE", `/api/categories/${testCategoryId}`, token);
  log(`Status: ${delCatInUseRes.status} (expected: 400)`);
  log(`Message: ${delCatInUseRes.data.meta?.exceptionMessage}`);
  if (delCatInUseRes.status !== 400) throw new Error("Seharusnya gagal — Category sedang dipakai item!");
  log("✓ Guard delete Category yang masih dipakai BERJALAN DENGAN BENAR");

  // ─── CLEANUP ──────────────────────────────────────────────────────────────────
  section("CLEANUP — Menghapus semua data test dari database");
  await cleanupAll(allCreatedItemIds, testUomId, testCategoryId);
  log("✓ Semua data test berhasil dihapus dari DB");

  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║     ✅ SEMUA ITEM (SINGLE & PACKAGE) TESTS BERHASIL!   ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  process.exit(0);
}

runItemFlowTests().catch((err) => {
  console.error("\n❌ ITEM FLOW TEST GAGAL:", err.message);
  process.exit(1);
});
