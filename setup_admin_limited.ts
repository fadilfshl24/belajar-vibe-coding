import bcrypt from "bcryptjs";
import { db } from "./src/core/db";
import { users } from "./src/modules/user/user.schema";
import { userWarehouseRoles, roles } from "./src/modules/role/role.schema";
import { roleMenuPermissions } from "./src/modules/permission/permission.schema";
import { menus } from "./src/modules/menu/menu.schema";
import { warehouses } from "./src/modules/warehouse/warehouse.schema";
import { eq } from "drizzle-orm";

console.log("Setting up admin user with limited permissions (master_data and transaksi only)...");

// 1. Clean up existing user if any
const existingUsers = await db.select().from(users).where(eq(users.email, "admin@gmail.com"));
if (existingUsers.length > 0) {
  const userId = existingUsers[0].id;
  await db.delete(userWarehouseRoles).where(eq(userWarehouseRoles.userId, userId));
  await db.delete(users).where(eq(users.id, userId));
  console.log("Cleared existing admin@gmail.com user.");
}

// 2. Retrieve admin role and default warehouse
const adminRole = await db.select().from(roles).where(eq(roles.name, "admin")).limit(1);
const warehouse = await db.select().from(warehouses).where(eq(warehouses.code, "WH-001")).limit(1);

if (adminRole.length === 0) {
  throw new Error("Admin role not found!");
}
const adminRoleId = adminRole[0].id;
const warehouseId = warehouse[0].id;

// 3. Create user
const hashedPassword = await bcrypt.hash("admin123", 10);
const [newUser] = await db.insert(users).values({
  name: "Admin",
  email: "admin@gmail.com",
  password: hashedPassword,
  status: 1, // aktif
}).returning();

console.log(`Created user Admin (${newUser.id})`);

// 4. Map user to admin role on default warehouse
await db.insert(userWarehouseRoles).values({
  userId: newUser.id,
  warehouseId,
  roleId: adminRoleId,
});

console.log("Mapped user to Admin role in WH-001.");

// 5. Setup role menu permissions for Admin Role
await db.delete(roleMenuPermissions).where(eq(roleMenuPermissions.roleId, adminRoleId));
const allMenus = await db.select().from(menus);

// Allowed menu codes: only master_data and transaksi (including their submenus)
const allowedMenuCodes = [
  "master_data",
  "item",
  "gudang",
  "kategori",
  "uom",
  "transaksi",
  "barang_masuk",
  "barang_keluar"
];

for (const menu of allMenus) {
  const isAllowed = allowedMenuCodes.includes(menu.code);
  await db.insert(roleMenuPermissions).values({
    roleId: adminRoleId,
    menuId: menu.id,
    canView: isAllowed,
    canCreate: isAllowed,
    canUpdate: isAllowed,
    canDelete: isAllowed,
  });
}

console.log("Configured limited Admin role permissions successfully!");
process.exit(0);
