import { eq } from "drizzle-orm";
import { db } from "../db/index";
import { users } from "../db/schema";

export type UserRecord = typeof users.$inferSelect;

export class UserModel {
  /**
   * Find a user by email. Returns undefined if not found.
   */
  static async findByEmail(email: string): Promise<UserRecord | undefined> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return result[0];
  }

  /**
   * Insert a new user. Status defaults to 1 (active).
   * Password must already be hashed before calling this method.
   */
  static async createUser(payload: {
    name: string;
    email: string;
    password: string;
  }): Promise<UserRecord> {
    const result = await db
      .insert(users)
      .values({
        name: payload.name.trim(),
        email: payload.email.toLowerCase().trim(),
        password: payload.password,
        status: 1,
      })
      .returning();

    if (!result[0]) {
      throw new Error("Insert did not return a record");
    }

    return result[0];
  }
}
