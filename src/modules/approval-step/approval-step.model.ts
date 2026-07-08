import { eq, desc, ilike, or, and, isNull, asc } from "drizzle-orm";
import { approvalSteps } from "./approval-step.schema";
import type { CreateApprovalStepInput, UpdateApprovalStepInput } from "./approval-step.dto";
import { db } from "../../core/db";
import { users, roles, userWarehouseRoles, userWarehouseMappings } from "../../core/db/schema";

export class ApprovalStepModel {
  static async findAll({
    page = 1,
    limit = 10,
    documentType,
  }: {
    page?: number;
    limit?: number;
    documentType?: string;
  }) {
    const offset = (page - 1) * limit;
    let baseWhere = isNull(approvalSteps.deletedAt);
    
    if (documentType) {
      baseWhere = and(baseWhere, eq(approvalSteps.documentType, documentType))!;
    }

    return await db.query.approvalSteps.findMany({
      where: baseWhere,
      limit,
      offset,
      orderBy: [asc(approvalSteps.documentType), asc(approvalSteps.stage)],
      with: {
        role: true,
      },
    });
  }

  static async countAll(documentType?: string) {
    let baseWhere = isNull(approvalSteps.deletedAt);
    if (documentType) {
      baseWhere = and(baseWhere, eq(approvalSteps.documentType, documentType))!;
    }
    const result = await db.select({ id: approvalSteps.id }).from(approvalSteps).where(baseWhere);
    return result.length;
  }

  static async findById(id: string) {
    return await db.query.approvalSteps.findFirst({
      where: and(eq(approvalSteps.id, id), isNull(approvalSteps.deletedAt)),
      with: {
        role: true,
      }
    });
  }

  static async findByDocumentAndStage(documentType: string, stage: number) {
    return await db.query.approvalSteps.findFirst({
      where: and(
        eq(approvalSteps.documentType, documentType),
        eq(approvalSteps.stage, stage),
        isNull(approvalSteps.deletedAt)
      ),
    });
  }

  static async findByDocument(documentType: string) {
    return await db.query.approvalSteps.findMany({
      where: and(
        eq(approvalSteps.documentType, documentType),
        isNull(approvalSteps.deletedAt)
      ),
      orderBy: [asc(approvalSteps.stage)],
      with: {
        role: true,
      }
    });
  }

  static async create(data: CreateApprovalStepInput, userId?: string) {
    const [record] = await db
      .insert(approvalSteps)
      .values({
        ...data,
        createdBy: userId,
      })
      .returning();
    return record;
  }

  static async update(id: string, data: UpdateApprovalStepInput, userId?: string) {
    const [record] = await db
      .update(approvalSteps)
      .set({
        ...data,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(approvalSteps.id, id))
      .returning();
    return record;
  }

  static async softDelete(id: string, userId?: string) {
    await db
      .update(approvalSteps)
      .set({
        deletedAt: new Date(),
      })
      .where(eq(approvalSteps.id, id));
  }

  static async getApproversByDocument(documentType: string, warehouseId?: string) {
    // 1. Ambil semua active approval steps untuk documentType, urut berdasarkan stage
    const steps = await this.findByDocument(documentType);
    if (!steps || steps.length === 0) return [];

    // 2. Ambil semua users yang punya role dan di map ke warehouseId ini (jika ada warehouseId)
    // Jika tidak ada warehouseId (misal PR tanpa warehouse), mungkin kita query user berdasarkan role saja.
    // Tapi untuk WMS, biasanya berbasis warehouse.
    
    // Kita query userWarehouseRoles join users dan roles.
    let baseWhere = and(
      isNull(userWarehouseRoles.deletedAt),
      isNull(users.deletedAt)
    );

    let specificRolesData = [];

    if (warehouseId) {
      specificRolesData = await db
        .select({
          userId: users.id,
          userName: users.name,
          userEmail: users.email,
          roleId: roles.id,
          roleCode: roles.code,
          roleName: roles.name,
        })
        .from(userWarehouseRoles)
        .innerJoin(users, eq(userWarehouseRoles.userId, users.id))
        .innerJoin(roles, eq(userWarehouseRoles.roleId, roles.id))
        .innerJoin(userWarehouseMappings, eq(userWarehouseMappings.userId, users.id))
        .where(
          and(
            baseWhere,
            eq(userWarehouseMappings.warehouseId, warehouseId),
            eq(userWarehouseMappings.isActive, true),
            isNull(userWarehouseMappings.deletedAt)
          )
        );
    } else {
      specificRolesData = await db
        .select({
          userId: users.id,
          userName: users.name,
          userEmail: users.email,
          roleId: roles.id,
          roleCode: roles.code,
          roleName: roles.name,
        })
        .from(userWarehouseRoles)
        .innerJoin(users, eq(userWarehouseRoles.userId, users.id))
        .innerJoin(roles, eq(userWarehouseRoles.roleId, roles.id))
        .where(baseWhere);
    }

    // Filter unique users per role
    const usersByRoleId: Record<string, any[]> = {};
    for (const record of specificRolesData) {
      if (!usersByRoleId[record.roleId]) {
        usersByRoleId[record.roleId] = [];
      }
      // hindari duplikasi
      if (!usersByRoleId[record.roleId].find(u => u.userId === record.userId)) {
        usersByRoleId[record.roleId].push({
          userId: record.userId,
          userName: record.userName,
          userEmail: record.userEmail,
          roleCode: record.roleCode,
        });
      }
    }

    // 3. Mapping hasil
    const result = steps.filter(s => s.isActive).map(step => {
      const stepUsers = usersByRoleId[step.roleId] || [];
      return {
        id: step.id,
        stage: step.stage,
        roleId: step.roleId,
        roleName: step.role?.name || "Unknown Role",
        users: stepUsers,
      };
    });

    return result;
  }
}
