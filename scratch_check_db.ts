import { db } from "../src/core/db";
import { userWarehouseRoles } from "../src/modules/role/role.schema";
import { roles } from "../src/modules/role/role.schema";
import { users } from "../src/modules/user/user.schema";
import { warehouses } from "../src/modules/warehouse/warehouse.schema";
import { eq } from "drizzle-orm";

async function main() {
  const result = await db
    .select({
      userName: users.name,
      roleName: roles.code,
      warehouseName: warehouses.name,
      warehouseId: warehouses.id
    })
    .from(userWarehouseRoles)
    .innerJoin(users, eq(userWarehouseRoles.userId, users.id))
    .innerJoin(roles, eq(userWarehouseRoles.roleId, roles.id))
    .leftJoin(warehouses, eq(userWarehouseRoles.warehouseId, warehouses.id));
  
  console.log(result);
  process.exit(0);
}

main().catch(console.error);
