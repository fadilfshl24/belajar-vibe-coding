import { eq, and, gt } from "drizzle-orm";
import { db } from "../db/index";
import { userSessions, users } from "../db/schema";

export type SessionRecord = typeof userSessions.$inferSelect;
export type UserRecord = typeof users.$inferSelect;

export class SessionModel {
  /**
   * Create a new session for a user.
   * Session is valid for the duration configured in JWT_REFRESH_EXPIRES_IN (default: 7 days).
   */
  static async createSession(
    userId: string,
    userAgent?: string,
    ipAddress?: string
  ): Promise<SessionRecord> {
    const sessionId = crypto.randomUUID();
    
    // Parse expiration (e.g. "7d", "1d", default to 7 days)
    const refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN ?? "7d";
    let days = 7;
    if (refreshExpiresIn.endsWith("d")) {
      const parsedDays = parseInt(refreshExpiresIn.slice(0, -1), 10);
      if (!isNaN(parsedDays)) {
        days = parsedDays;
      }
    }
    
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    const result = await db
      .insert(userSessions)
      .values({
        id: sessionId,
        userId,
        userAgent,
        ipAddress,
        expiresAt,
        isRevoked: false,
      })
      .returning();

    if (!result[0]) {
      throw new Error("Failed to create user session");
    }

    return result[0];
  }

  /**
   * Validate a session by ID.
   * Checks if it exists, is not revoked, is not soft-deleted, and is not expired.
   * Returns the session and joined user record if valid.
   */
  static async validateSession(
    sessionId: string
  ): Promise<(SessionRecord & { user: UserRecord }) | null> {
    const now = new Date();
    
    const result = await db
      .select({
        session: userSessions,
        user: users,
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

    if (!result[0]) {
      return null;
    }

    // Check if user is active and not soft-deleted
    const { session, user } = result[0];
    if (user.status !== 1 || user.deletedAt) {
      return null;
    }

    return { ...session, user };
  }

  /**
   * Revoke a session by marking it as revoked.
   */
  static async revokeSession(sessionId: string): Promise<boolean> {
    const result = await db
      .update(userSessions)
      .set({
        isRevoked: true,
        updatedAt: new Date(),
      })
      .where(eq(userSessions.id, sessionId))
      .returning({ id: userSessions.id });

    return result.length > 0;
  }
}
