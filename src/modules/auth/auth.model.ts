import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "../../core/db";
import { userSessions, userOauthAccounts } from "./auth.schema";
import { users } from "../user/user.schema";

export type SessionRecord = typeof userSessions.$inferSelect;

// ---------------------------------------------------------------------------
// Session Model
// ---------------------------------------------------------------------------

export class SessionModel {
  /**
   * Membuat sesi baru di database.
   * Durasi sesi dikonfigurasi via JWT_REFRESH_EXPIRES_IN di .env (default: "7d").
   */
  static async createSession(
    userId: string,
    userAgent?: string,
    ipAddress?: string
  ): Promise<SessionRecord> {
    const sessionId = crypto.randomUUID();

    // Parse expiration dari format "7d" → jumlah hari
    const refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN ?? "7d";
    let days = 7;
    if (refreshExpiresIn.endsWith("d")) {
      const parsed = parseInt(refreshExpiresIn.slice(0, -1), 10);
      if (!isNaN(parsed)) days = parsed;
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    const result = await db
      .insert(userSessions)
      .values({ id: sessionId, userId, userAgent, ipAddress, expiresAt, isRevoked: false })
      .returning();

    if (!result[0]) throw new Error("Failed to create user session");
    return result[0];
  }

  /**
   * Memvalidasi session token.
   * Cek: sesi ada, tidak revoked, belum expired, user aktif & tidak soft-deleted.
   * Mengembalikan session + user jika valid, atau null jika tidak valid.
   */
  static async validateSession(
    sessionId: string
  ): Promise<(SessionRecord & { user: { email: string; status: number } }) | null> {
    const now = new Date();

    const result = await db
      .select({
        session: userSessions,
        user: {
          email: users.email,
          status: users.status,
          deletedAt: users.deletedAt,
        },
      })
      .from(userSessions)
      .innerJoin(users, eq(userSessions.userId, users.id))
      .where(
        and(
          eq(userSessions.id, sessionId),
          eq(userSessions.isRevoked, false),
          gt(userSessions.expiresAt, now)
        )
      )
      .limit(1);

    const row = result[0];
    if (!row) return null;

    // Pastikan user aktif dan belum di-soft-delete
    if (row.user.status !== 1 || row.user.deletedAt !== null) return null;

    return { ...row.session, user: { email: row.user.email, status: row.user.status } };
  }

  /**
   * Menonaktifkan sesi (logout). Mengembalikan true jika berhasil.
   */
  static async revokeSession(sessionId: string): Promise<boolean> {
    const result = await db
      .update(userSessions)
      .set({ isRevoked: true, updatedAt: new Date() })
      .where(eq(userSessions.id, sessionId))
      .returning({ id: userSessions.id });

    return result.length > 0;
  }
}

// ---------------------------------------------------------------------------
// OAuth Model
// ---------------------------------------------------------------------------

export class OauthModel {
  /**
   * Mencari akun OAuth berdasarkan provider dan provider user ID.
   */
  static async findAccount(provider: string, providerUserId: string) {
    const result = await db
      .select()
      .from(userOauthAccounts)
      .where(
        and(
          eq(userOauthAccounts.provider, provider),
          eq(userOauthAccounts.providerUserId, providerUserId),
          isNull(userOauthAccounts.deletedAt)
        )
      )
      .limit(1);

    return result[0];
  }

  /**
   * Menghubungkan akun OAuth ke user yang sudah ada di sistem.
   */
  static async linkAccount(params: {
    userId: string;
    provider: string;
    providerUserId: string;
    providerEmail?: string;
    accessToken?: string;
  }) {
    const result = await db
      .insert(userOauthAccounts)
      .values({
        userId: params.userId,
        provider: params.provider,
        providerUserId: params.providerUserId,
        providerEmail: params.providerEmail,
        accessToken: params.accessToken,
      })
      .returning();

    return result[0];
  }
}
