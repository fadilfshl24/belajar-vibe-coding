import { eq, and } from "drizzle-orm";
import { db } from "../db/index";
import { userOauthAccounts } from "../db/schema";

export type OauthAccountRecord = typeof userOauthAccounts.$inferSelect;

export class OauthModel {
  /**
   * Find an OAuth account mapping by provider and provider's user ID.
   */
  static async findAccount(
    provider: string,
    providerUserId: string
  ): Promise<OauthAccountRecord | undefined> {
    const result = await db
      .select()
      .from(userOauthAccounts)
      .where(
        and(
          eq(userOauthAccounts.provider, provider),
          eq(userOauthAccounts.providerUserId, providerUserId)
        )
      )
      .limit(1);

    return result[0];
  }

  /**
   * Link an existing user with an OAuth provider account.
   */
  static async linkAccount(payload: {
    userId: string;
    provider: string;
    providerUserId: string;
    providerEmail?: string;
    accessToken?: string;
    refreshToken?: string;
  }): Promise<OauthAccountRecord> {
    const result = await db
      .insert(userOauthAccounts)
      .values({
        userId: payload.userId,
        provider: payload.provider,
        providerUserId: payload.providerUserId,
        providerEmail: payload.providerEmail,
        accessToken: payload.accessToken,
        refreshToken: payload.refreshToken,
      })
      .returning();

    if (!result[0]) {
      throw new Error("Failed to link OAuth account");
    }

    return result[0];
  }
}
