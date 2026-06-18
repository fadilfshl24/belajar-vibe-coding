import { db } from "../db";
import { activityLogs } from "../../modules/activity-log/activity-log.schema";
import { users } from "../../modules/user/user.schema";
import { eq } from "drizzle-orm";

export interface LogActivityParams {
  /** UUID user yang melakukan aksi. Opsional untuk aksi sistem/guest. */
  userId?: string;
  /**
   * Kode aksi standar. Gunakan konstanta berikut untuk konsistensi:
   * LOGIN, LOGOUT, REGISTER, CREATE_DATA, UPDATE_DATA, DELETE_DATA,
   * CREATE_ORDER, UPDATE_ORDER, DELETE_ORDER, UPDATE_PERMISSION.
   */
  action: string;
  /**
   * Deskripsi lengkap aktivitas. Format standar:
   * "User [Username] melakukan [aksi] terhadap [entitas]"
   */
  description: string;
  /** IP address client (opsional) */
  ipAddress?: string;
  /** User-Agent header (opsional) */
  userAgent?: string;
}

/**
 * logActivity
 *
 * Helper global untuk mencatat log aktivitas ke tabel activity_logs.
 * Dipanggil di setiap controller/handler yang melakukan operasi penting.
 *
 * Fungsi ini bersifat "fire and forget" — jika gagal, error hanya di-log
 * ke console tanpa mengganggu response utama ke client.
 *
 * @example
 * await logActivity({
 *   userId: user.id,
 *   action: "LOGIN",
 *   description: `User ${user.name} berhasil masuk ke sistem`,
 *   ipAddress,
 *   userAgent,
 * });
 */
export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    let username: string | undefined = undefined;

    if (params.userId) {
      const result = await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, params.userId))
        .limit(1);
      username = result[0]?.name;
    }

    await db.insert(activityLogs).values({
      userId: params.userId,
      username,
      action: params.action,
      description: params.description,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });
  } catch (error) {
    console.error("[ActivityLogger] Failed to log activity:", error);
  }
}
