# Implementation Plan: Hierarchical Menus & Role Permissions (Issue #13)

## Goal
Implement hierarchical menus by adding `parentId` and `sortOrder` to the `menus` table, and enforce a business rule where `role_menu_permissions` can only be assigned to "leaf nodes" (menus without children).

## User Review Required
> [!IMPORTANT]
> - Do you want the `sortOrder` to be required or optional? I will make it optional with a default value of `0`.
> - Do we need to recursively delete children when a parent menu is deleted, or just prevent deletion of a parent if it has children? I plan to prevent deletion of a parent if it has active children.

## Proposed Changes

---

### Database Schema (Drizzle)

#### [MODIFY] [menu.schema.ts](file:///d:/_Code/vibe-coding/belajar-vibe-coding/src/modules/menu/menu.schema.ts)
- Add `parentId` column using a self-referencing foreign key: `uuid("parent_id").references((): AnyPgColumn => menus.id)`
- Add `sortOrder` column: `integer("sort_order").notNull().default(0)`

#### [NEW] Database Migration
- Run `bun run db:generate` to generate the new SQL migration files.

---

### Validation Layer (Zod)

#### [MODIFY] [menu.validation.ts](file:///d:/_Code/vibe-coding/belajar-vibe-coding/src/modules/menu/menu.validation.ts)
- Update `createMenuSchema` to include optional `parentId` (UUID) and `sortOrder` (number).
- `updateMenuSchema` automatically inherits these as optional since it uses `.partial()`.

#### [MODIFY] [menu.dto.ts](file:///d:/_Code/vibe-coding/belajar-vibe-coding/src/modules/menu/menu.dto.ts)
- Update `MenuDTO` to include `parentId` and `sortOrder`.

---

### Data Models & Controllers

#### [MODIFY] [menu.model.ts](file:///d:/_Code/vibe-coding/belajar-vibe-coding/src/modules/menu/menu.model.ts)
- In `createMenu` and `updateMenu`, pass `parentId` and `sortOrder`.
- Update `findAll` to include `parentId` and `sortOrder` in sorting and returning data.
- Update `softDelete` to reject the deletion if there are any child menus referencing the `id` being deleted.

#### [MODIFY] [permission.controller.ts](file:///d:/_Code/vibe-coding/belajar-vibe-coding/src/modules/permission/permission.controller.ts)
- In `bulkUpdate`, extract all `menuId`s from the payload.
- Before calling `PermissionModel.bulkUpsert`, check if any of these `menuId`s are used as a `parentId` in the `menus` table.
- If any `menuId` is a parent menu, return a `400 Bad Request` with an appropriate message.

#### [MODIFY] [permission.model.ts](file:///d:/_Code/vibe-coding/belajar-vibe-coding/src/modules/permission/permission.model.ts)
- Add a new helper function `checkIfAnyIsParent(menuIds: string[]): Promise<string[]>` to query if any provided menu ID has children.

## Verification Plan

### Automated Tests
- N/A for this module, but will test via API endpoints.

### Manual Verification
1. Create a "Master Data" menu (no parent).
2. Create an "Item" menu with "Master Data" as `parentId`.
3. Attempt to assign permissions to "Master Data" via `/api/role-permissions` -> Should fail with 400 Bad Request.
4. Attempt to assign permissions to "Item" -> Should succeed.
5. Fetch the menus list and verify `parentId` and `sortOrder` are returned correctly.
