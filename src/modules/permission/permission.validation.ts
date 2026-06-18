import { z } from "zod";

/**
 * Schema untuk update permission satu baris (role + menu specific).
 */
const updatePermissionSchema = z.object({
  roleId: z.string().uuid("roleId must be a valid UUID"),
  menuId: z.string().uuid("menuId must be a valid UUID"),
  canView: z.boolean().default(false),
  canCreate: z.boolean().default(false),
  canUpdate: z.boolean().default(false),
  canDelete: z.boolean().default(false),
});

export function parseUpdatePermissionInput(body: unknown) {
  return updatePermissionSchema.safeParse(body);
}

export type UpdatePermissionInput = z.infer<typeof updatePermissionSchema>;

/**
 * Schema untuk bulk update permissions (array).
 */
const bulkUpdatePermissionsSchema = z.object({
  permissions: z.array(updatePermissionSchema).min(1, "At least one permission is required"),
});

export function parseBulkUpdatePermissionsInput(body: unknown) {
  return bulkUpdatePermissionsSchema.safeParse(body);
}

export type BulkUpdatePermissionsInput = z.infer<typeof bulkUpdatePermissionsSchema>;
