import { db } from "./index";
import { roles, userWarehouseRoles } from "../../modules/role/role.schema";
import { users } from "../../modules/user/user.schema";
import { and, eq, isNull } from "drizzle-orm";

async function main() {
  const branchHeadRoles = await db.select({
    id: userWarehouseRoles.id,
    userId: userWarehouseRoles.userId,
    warehouseId: userWarehouseRoles.warehouseId,
    userName: users.name
  })
  .from(userWarehouseRoles)
  .innerJoin(roles, eq(userWarehouseRoles.roleId, roles.id))
  .innerJoin(users, eq(userWarehouseRoles.userId, users.id))
  .where(
    and(
      eq(roles.code, "branch_head"),
      isNull(userWarehouseRoles.deletedAt)
    )
  );

  console.log("Current Branch Heads in user_warehouse_roles:");
  console.log(branchHeadRoles);

  process.exit(0);
}

main().catch(console.error);
