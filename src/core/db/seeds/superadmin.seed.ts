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
export async function seedSuperadmin(): Promise<string> {
  console.log("👤 Seeding superadmin user...");

  const SUPERADMIN_EMAIL = "adminit@gmail.com";
  const SUPERADMIN_NAME = "Superadmin";
  const SUPERADMIN_PASSWORD = "12345678";

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, SUPERADMIN_EMAIL), isNull(users.deletedAt)))
    .limit(1);

  if (existing[0]) {
    console.log(`  ✓ Superadmin "${SUPERADMIN_EMAIL}" already exists`);
    return existing[0].id;
  }

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

  const userId = inserted[0]!.id;
  console.log(`  + Superadmin "${SUPERADMIN_EMAIL}" created (ID: ${userId})`);
  console.log(`  ℹ Default password: ${SUPERADMIN_PASSWORD} — Ganti setelah login pertama!`);

  return userId;
}
