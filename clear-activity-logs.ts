import { db } from "./src/core/db";
import { activityLogs } from "./src/modules/activity-log/activity-log.schema";

async function clearActivityLogs() {
  console.log("Clearing activity logs...");
  await db.delete(activityLogs);
  console.log("Activity logs cleared successfully.");
  process.exit(0);
}

clearActivityLogs().catch(err => {
  console.error("Failed to clear activity logs:", err);
  process.exit(1);
});
