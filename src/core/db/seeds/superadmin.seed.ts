import bcrypt from "bcryptjs";
import { db } from "../index";
import { users } from "../../../modules/user/user.schema";
import { eq, isNull, and } from "drizzle-orm";

/**
 * Seed: Superadmin User
 *
 * Membuat akun Superadmin default jika belum ada.
 * Password di-hash dengan bcrypt sebelum disimpan.
 *
 * Kredensial default:
 * - Email    : adminit@gmail.com
 * - Password : 12345678
 *
 * ⚠ PENTING: Ganti password ini setelah deployment pertama ke production!
 */
import { warehouses } from "../../../modules/warehouse/warehouse.schema";
import { userWarehouseRoles } from "../../../modules/role/role.schema";

/**
 * Seed: Superadmin User & Default Warehouse Role Mapping
 *
 * Membuat akun Superadmin default jika belum ada, membuat gudang default,
 * dan menghubungkan superadmin ke role superadmin di gudang tersebut.
 */
export async function seedSuperadmin(superadminRoleId: string): Promise<string> {
  console.log("👤 Seeding superadmin user and default warehouse mapping...");

  const SUPERADMIN_EMAIL = "adminit@gmail.com";
  const SUPERADMIN_NAME = "Superadmin";
  const SUPERADMIN_PASSWORD = "12345678";

  // 1. Get or create Superadmin User
  let userId: string;
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, SUPERADMIN_EMAIL), isNull(users.deletedAt)))
    .limit(1);

  if (existing[0]) {
    console.log(`  ✓ Superadmin "${SUPERADMIN_EMAIL}" already exists`);
    userId = existing[0].id;
  } else {
    const hashedPassword = await bcrypt.hash(SUPERADMIN_PASSWORD, 10);
    const inserted = await db
      .insert(users)
      .values({
        name: SUPERADMIN_NAME,
        email: SUPERADMIN_EMAIL,
        password: hashedPassword,
        status: 1,
      })
      .returning({ id: users.id });

    userId = inserted[0]!.id;
    console.log(`  + Superadmin "${SUPERADMIN_EMAIL}" created (ID: ${userId})`);
    console.log(`  ℹ Default password: ${SUPERADMIN_PASSWORD} — Ganti setelah login pertama!`);
  }

  // 2. Get or create Default Warehouse
  let warehouseId: string;
  const existingWH = await db
    .select({ id: warehouses.id })
    .from(warehouses)
    .where(and(eq(warehouses.code, "WH-001"), isNull(warehouses.deletedAt)))
    .limit(1);

  if (existingWH[0]) {
    warehouseId = existingWH[0].id;
    console.log(`  ✓ Default Warehouse WH-001 already exists`);
  } else {
    const insertedWH = await db
      .insert(warehouses)
      .values({
        code: "WH-001",
        name: "Gudang Utama",
        description: "Gudang Utama Default",
        isActive: true,
      })
      .returning({ id: warehouses.id });
    warehouseId = insertedWH[0]!.id;
    console.log(`  + Default Warehouse WH-001 created`);
  }

  // 3. Link Superadmin User to Warehouse and Role
  const existingMapping = await db
    .select({ id: userWarehouseRoles.id })
    .from(userWarehouseRoles)
    .where(
      and(
        eq(userWarehouseRoles.userId, userId),
        eq(userWarehouseRoles.warehouseId, warehouseId),
        eq(userWarehouseRoles.roleId, superadminRoleId),
        isNull(userWarehouseRoles.deletedAt)
      )
    )
    .limit(1);

  if (existingMapping[0]) {
    console.log(`  ✓ Superadmin role mapping already exists for WH-001`);
  } else {
    await db.insert(userWarehouseRoles).values({
      userId,
      warehouseId,
      roleId: superadminRoleId,
    });
    console.log(`  + Superadmin role mapped to WH-001 successfully`);
  }

  return userId;
}
