import { db } from "../db/index";
import { activityLogs, users } from "../db/schema";
import { eq } from "drizzle-orm";

export async function logActivity(params: {
  userId?: string;
  action: string;
  description: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  try {
    let username: string | undefined = undefined;
    
    // Look up username if userId is provided
    if (params.userId) {
      const user = await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, params.userId))
        .limit(1);
      username = user[0]?.name;
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
    console.error("Failed to log activity:", error);
  }
}
