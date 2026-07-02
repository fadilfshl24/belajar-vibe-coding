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
  { name: "superadmin", description: "Administrator tertinggi dengan akses penuh ke seluruh sistem" },
  { name: "admin", description: "Administrator yang dapat mengelola user, master data, dan konfigurasi" },
  { name: "warehouse_head", description: "Kepala gudang yang mengelola operasional dan inventaris gudang" },
  { name: "branch_head", description: "Kepala cabang yang menyetujui operasional tingkat cabang" },
  { name: "manager", description: "Manager pusat yang memvalidasi persetujuan tingkat tertinggi" },
  { name: "staff", description: "Staff operasional yang memproses order keluar-masuk" },
  { name: "user", description: "Pengguna biasa dengan akses terbatas" },
] as const;

export async function seedRoles(): Promise<Record<string, string>> {
  console.log("📦 Seeding roles...");
  const roleIdMap: Record<string, string> = {};

  for (const role of ROLES) {
    const existing = await db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, role.name))
      .limit(1);

    if (existing[0]) {
      roleIdMap[role.name] = existing[0].id;
      console.log(`  ✓ Role "${role.name}" already exists`);
    } else {
      const inserted = await db.insert(roles).values(role).returning({ id: roles.id });
      roleIdMap[role.name] = inserted[0]!.id;
      console.log(`  + Role "${role.name}" created`);
    }
  }

  return roleIdMap;
}
