/**
 * approval-stage.resolver.ts
 *
 * Shared utility untuk menentukan approval stage yang dibutuhkan oleh user
 * berdasarkan konfigurasi approval_steps yang ada di database.
 *
 * Logic:
 * - Query approval_steps untuk documentType tertentu (PR, QP, PO, QC)
 * - Cari stage mana yang roleId-nya cocok dengan role user saat ini
 * - Return stage tersebut sebagai `requiredApprovalStage`
 * - Jika user punya beberapa role yang cocok di berbagai stage → return undefined
 *   (tidak dibatasi, bisa lihat semua)
 * - Jika user tidak punya role di approval steps → return undefined
 *   (filter stage tidak berlaku, handled oleh visibility logic di controller)
 */

import { db } from "../db";
import { approvalSteps } from "../../modules/approval-step/approval-step.schema";
import { userWarehouseRoles, roles } from "../../modules/role/role.schema";
import { eq, and, isNull, inArray } from "drizzle-orm";

export type DocumentType = "PR" | "QP" | "PO" | "GR" | "QC" | "SCRAP" | "AO";

/**
 * Resolve the `requiredApprovalStage` for a user on a given document type.
 *
 * Returns:
 * - `number` – the single stage index this user needs to approve at
 * - `undefined` – user has no matching stage (no restriction), or has multiple stages
 *   (e.g. user has both WH Head and Branch Head roles)
 */
export async function resolveRequiredApprovalStage(
  userId: string,
  documentType: DocumentType
): Promise<number | undefined> {
  // 1. Get user's active role IDs
  const userRoleRows = await db
    .select({ roleId: userWarehouseRoles.roleId, roleCode: roles.code })
    .from(userWarehouseRoles)
    .innerJoin(roles, eq(userWarehouseRoles.roleId, roles.id))
    .where(
      and(
        eq(userWarehouseRoles.userId, userId),
        isNull(userWarehouseRoles.deletedAt),
        isNull(roles.deletedAt)
      )
    );

  if (userRoleRows.length === 0) return undefined;

  const userRoleIds = [...new Set(userRoleRows.map((r) => r.roleId))];
  const userRoleCodes = [...new Set(userRoleRows.map((r) => r.roleCode))];

  // Global admins are never stage-restricted
  const isGlobalAdmin = userRoleCodes.some((r) =>
    ["superadmin", "admin"].includes(r)
  );
  if (isGlobalAdmin) return undefined;

  // 2. Fetch approval steps for this document type, ordered by stage
  const steps = await db
    .select({
      stage: approvalSteps.stage,
      roleId: approvalSteps.roleId,
    })
    .from(approvalSteps)
    .where(
      and(
        eq(approvalSteps.documentType, documentType),
        eq(approvalSteps.isActive, true),
        isNull(approvalSteps.deletedAt)
      )
    )
    .orderBy(approvalSteps.stage);

  if (steps.length === 0) return undefined;

  // 3. Find which stages this user's roles match
  const matchingStages = steps
    .filter((step) => userRoleIds.includes(step.roleId))
    .map((step) => step.stage);

  if (matchingStages.length === 0) {
    // User has no approval role for this document — let controller handle visibility
    return undefined;
  }

  if (matchingStages.length === 1) {
    // User is approver for exactly one stage → restrict to that stage
    return matchingStages[0];
  }

  // User is approver for multiple stages (e.g. has both WH Head + Branch Head roles)
  // → no stage restriction; they can see all pending PRs
  return undefined;
}
