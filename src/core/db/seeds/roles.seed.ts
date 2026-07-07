import { db } from "../index";
import { roles } from "../../../modules/role/role.schema";
import { isNull, eq } from "drizzle-orm";

/**
 * Seed: Roles
 *
 * Membuat 5 role default sesuai kebutuhan WMS.
 * Bersifat idempotent — tidak akan insert duplikat jika sudah ada.
 */
export const ROLES = [
  { code: "superadmin", name: "Super Admin", description: "Administrator tertinggi dengan akses penuh ke seluruh sistem" },
  { code: "admin", name: "Admin", description: "Administrator yang dapat mengelola user, master data, dan konfigurasi" },
  { code: "warehouse_head", name: "Warehouse Head", description: "Kepala gudang yang mengelola operasional dan inventaris gudang" },
  { code: "branch_head", name: "Branch Head", description: "Kepala cabang yang menyetujui operasional tingkat cabang" },
  { code: "manager", name: "Manager", description: "Manager pusat yang memvalidasi persetujuan tingkat tertinggi" },
  { code: "staff", name: "Staff", description: "Staff operasional yang memproses order keluar-masuk" },
  { code: "user", name: "User", description: "Pengguna biasa dengan akses terbatas" },
] as const;

export async function seedRoles(): Promise<Record<string, string>> {
  console.log("📦 Seeding roles...");
  const roleIdMap: Record<string, string> = {};

  for (const role of ROLES) {
    const existing = await db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.code, role.code))
      .limit(1);

    if (existing[0]) {
      roleIdMap[role.code] = existing[0].id;
      console.log(`  ✓ Role "${role.name}" (${role.code}) already exists`);
    } else {
      const inserted = await db.insert(roles).values(role).returning({ id: roles.id });
      roleIdMap[role.code] = inserted[0]!.id;
      console.log(`  + Role "${role.name}" (${role.code}) created`);
    }
  }

  return roleIdMap;
}
