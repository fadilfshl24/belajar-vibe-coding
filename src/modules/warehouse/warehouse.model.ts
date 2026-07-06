import { and, asc, count, desc, eq, ilike, isNull, or, notInArray } from "drizzle-orm";
import type { AnyColumn } from "drizzle-orm";
import { db } from "../../core/db";
import { warehouses, warehouseHeads } from "./warehouse.schema";
import { provinces, regencies, districts, villages } from "../region/region.schema";
import { users } from "../user/user.schema";
import { userWarehouseRoles, userWarehouseMappings, roles } from "../role/role.schema";
import { toWarehouseDTO, toWarehouseHeadDTO, type WarehouseDTO, type WarehouseHeadDTO } from "./warehouse.dto";
import type { WarehouseRecord, WarehouseHeadRecord } from "./warehouse.schema";
import type { CreateWarehouseInput, UpdateWarehouseInput } from "./warehouse.validation";

// ---------------------------------------------------------------------------
// Warehouse Model
// ---------------------------------------------------------------------------

function resolveOrderColumn(key: string): AnyColumn {
  const map: Record<string, AnyColumn> = {
    Id: warehouses.id,
    Code: warehouses.code,
    Name: warehouses.name,
    CreatedAt: warehouses.createdAt,
    UpdatedAt: warehouses.updatedAt,
  };
  return (map[key] ?? warehouses.createdAt) as AnyColumn;
}

function parseOrderBy(orderBy: string): { column: AnyColumn; direction: "asc" | "desc" } {
  try {
    const normalized = orderBy.replace(/'/g, '"');
    const parsed = JSON.parse(normalized) as Record<string, string>;
    const [key, dir] = Object.entries(parsed)[0] ?? ["CreatedAt", "DESC"];
    return {
      column: resolveOrderColumn(key),
      direction: (dir?.toUpperCase() === "ASC" ? "asc" : "desc") as "asc" | "desc",
    };
  } catch {
    return { column: warehouses.createdAt, direction: "desc" };
  }
}

function buildFilterCondition(params: { filterColumn?: string; searchTerm?: string; isActive?: boolean; excludeHasHead?: boolean }) {
  const { filterColumn, searchTerm, isActive, excludeHasHead } = params;
  let conds = isNull(warehouses.deletedAt);
  if (isActive !== undefined) {
    conds = and(conds, eq(warehouses.isActive, isActive))!;
  }
  if (searchTerm) {
    const term = searchTerm.trim();
    if (term !== "") {
      if (filterColumn === "name") {
        conds = and(conds, ilike(warehouses.name, `%${term}%`))!;
      } else if (filterColumn === "code") {
        conds = and(conds, ilike(warehouses.code, `%${term}%`))!;
      } else {
        conds = and(conds, or(ilike(warehouses.name, `%${term}%`), ilike(warehouses.code, `%${term}%`)))!;
      }
    }
  }
  if (excludeHasHead) {
    conds = and(conds, notInArray(warehouses.id, db.select({ id: warehouseHeads.warehouseId }).from(warehouseHeads).where(isNull(warehouseHeads.deletedAt))))!;
  }
  return conds;
}

export class WarehouseModel {
  static async findAll(params: {
    page: number;
    limit: number;
    orderBy: string;
    searchTerm?: string;
    filterColumn?: string;
    isActive?: boolean;
    excludeHasHead?: boolean;
  }): Promise<WarehouseDTO[]> {
    const { page, limit, orderBy, searchTerm, filterColumn, isActive, excludeHasHead } = params;
    const { column, direction } = parseOrderBy(orderBy);
    const whereClause = buildFilterCondition({ filterColumn, searchTerm, isActive, excludeHasHead });
    const offset = (page - 1) * limit;

    const result = await db
      .select({
        warehouse: warehouses,
        provinceName: provinces.name,
        regencyName: regencies.name,
        districtName: districts.name,
        villageName: villages.name,
      })
      .from(warehouses)
      .leftJoin(provinces, eq(warehouses.province, provinces.id))
      .leftJoin(regencies, eq(warehouses.cityRegency, regencies.id))
      .leftJoin(districts, eq(warehouses.district, districts.id))
      .leftJoin(villages, eq(warehouses.village, villages.id))
      .where(whereClause)
      .orderBy(direction === "asc" ? asc(column) : desc(column))
      .limit(limit)
      .offset(offset);

    return result.map(row => {
      const dto = toWarehouseDTO(row.warehouse);
      dto.provinceName = row.provinceName;
      dto.cityRegencyName = row.regencyName;
      dto.districtName = row.districtName;
      dto.villageName = row.villageName;
      return dto;
    });
  }

  static async countAll(params: { searchTerm?: string; filterColumn?: string; isActive?: boolean; excludeHasHead?: boolean }): Promise<number> {
    const whereClause = buildFilterCondition(params);
    const result = await db.select({ total: count() }).from(warehouses).where(whereClause);
    return result[0]?.total ?? 0;
  }

  static async findById(id: string): Promise<WarehouseDTO | undefined> {
    const result = await db
      .select({
        warehouse: warehouses,
        provinceName: provinces.name,
        regencyName: regencies.name,
        districtName: districts.name,
        villageName: villages.name,
      })
      .from(warehouses)
      .leftJoin(provinces, eq(warehouses.province, provinces.id))
      .leftJoin(regencies, eq(warehouses.cityRegency, regencies.id))
      .leftJoin(districts, eq(warehouses.district, districts.id))
      .leftJoin(villages, eq(warehouses.village, villages.id))
      .where(and(eq(warehouses.id, id), isNull(warehouses.deletedAt)))
      .limit(1);
    
    if (!result[0]) return undefined;
    const dto = toWarehouseDTO(result[0].warehouse);
    dto.provinceName = result[0].provinceName;
    dto.cityRegencyName = result[0].regencyName;
    dto.districtName = result[0].districtName;
    dto.villageName = result[0].villageName;
    return dto;
  }

  static async findByCode(code: string): Promise<WarehouseDTO | undefined> {
    const result = await db
      .select({
        warehouse: warehouses,
        provinceName: provinces.name,
        regencyName: regencies.name,
        districtName: districts.name,
        villageName: villages.name,
      })
      .from(warehouses)
      .leftJoin(provinces, eq(warehouses.province, provinces.id))
      .leftJoin(regencies, eq(warehouses.cityRegency, regencies.id))
      .leftJoin(districts, eq(warehouses.district, districts.id))
      .leftJoin(villages, eq(warehouses.village, villages.id))
      .where(and(eq(warehouses.code, code), isNull(warehouses.deletedAt)))
      .limit(1);
      
    if (!result[0]) return undefined;
    const dto = toWarehouseDTO(result[0].warehouse);
    dto.provinceName = result[0].provinceName;
    dto.cityRegencyName = result[0].regencyName;
    dto.districtName = result[0].districtName;
    dto.villageName = result[0].villageName;
    return dto;
  }

  static async create(payload: CreateWarehouseInput, userId?: string): Promise<WarehouseRecord> {
    const result = await db.insert(warehouses).values({
      code: payload.code.toUpperCase(),
      name: payload.name,
      description: payload.description || null,
      address: payload.address || null,
      province: payload.province || null,
      cityRegency: payload.cityRegency || null,
      district: payload.district || null,
      village: payload.village || null,
      zipCode: payload.zipCode || null,
      latitude: payload.latitude !== undefined ? String(payload.latitude) : null,
      longitude: payload.longitude !== undefined ? String(payload.longitude) : null,
      isActive: payload.isActive ?? true,
      createdBy: userId,
      updatedBy: userId,
    }).returning();

    if (!result[0]) throw new Error("Failed to create warehouse");
    return result[0];
  }

  static async update(id: string, payload: UpdateWarehouseInput, userId?: string): Promise<WarehouseDTO | undefined> {
    const updateData: any = {
      updatedAt: new Date(),
      updatedBy: userId,
    };
    if (payload.code !== undefined) updateData.code = payload.code.toUpperCase();
    if (payload.name !== undefined) updateData.name = payload.name;
    if (payload.description !== undefined) updateData.description = payload.description;
    if (payload.address !== undefined) updateData.address = payload.address;
    if (payload.province !== undefined) updateData.province = payload.province;
    if (payload.cityRegency !== undefined) updateData.cityRegency = payload.cityRegency;
    if (payload.district !== undefined) updateData.district = payload.district;
    if (payload.village !== undefined) updateData.village = payload.village;
    if (payload.zipCode !== undefined) updateData.zipCode = payload.zipCode;
    if (payload.latitude !== undefined) updateData.latitude = String(payload.latitude);
    if (payload.longitude !== undefined) updateData.longitude = String(payload.longitude);
    if (payload.isActive !== undefined) updateData.isActive = payload.isActive;

    const result = await db
      .update(warehouses)
      .set(updateData)
      .where(and(eq(warehouses.id, id), isNull(warehouses.deletedAt)))
      .returning();

    return result[0] ? toWarehouseDTO(result[0]) : undefined;
  }

  static async softDelete(id: string): Promise<boolean> {
    const result = await db
      .update(warehouses)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(warehouses.id, id), isNull(warehouses.deletedAt)))
      .returning({ id: warehouses.id });
    return result.length > 0;
  }
}

// ---------------------------------------------------------------------------
// Warehouse Head Model
// ---------------------------------------------------------------------------

export class WarehouseHeadModel {
  static async findByWarehouse(warehouseId: string): Promise<WarehouseHeadDTO[]> {
    const result = await db
      .select({
        head: warehouseHeads,
        user: {
          id: users.id,
          name: users.name,
          email: users.email
        }
      })
      .from(warehouseHeads)
      .innerJoin(users, eq(warehouseHeads.userId, users.id))
      .where(and(
        eq(warehouseHeads.warehouseId, warehouseId),
        isNull(warehouseHeads.deletedAt),
        isNull(users.deletedAt)
      ));
      
    return result.map(row => {
      const dto = toWarehouseHeadDTO(row.head);
      dto.user = row.user;
      return dto;
    });
  }

  static async assign(payload: { warehouseId: string, userId: string, description?: string }): Promise<WarehouseHeadRecord> {
    return await db.transaction(async (tx) => {
      const result = await tx.insert(warehouseHeads).values({
        warehouseId: payload.warehouseId,
        userId: payload.userId,
        description: payload.description || null,
        isActive: true,
      }).returning();

      if (!result[0]) throw new Error("Failed to assign warehouse head");

      const roleRes = await tx.select().from(roles).where(eq(roles.code, "warehouse_head")).limit(1);
      const headRoleId = roleRes[0]?.id;

      if (headRoleId) {
        await tx.insert(userWarehouseRoles).values({
          userId: payload.userId,
          warehouseId: payload.warehouseId,
          roleId: headRoleId,
        }).onConflictDoNothing();
      }

      await tx.insert(userWarehouseMappings).values({
        userId: payload.userId,
        warehouseId: payload.warehouseId,
      }).onConflictDoNothing();

      return result[0];
    });
  }

  static async softDelete(headId: string): Promise<boolean> {
    return await db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(warehouseHeads)
        .where(and(eq(warehouseHeads.id, headId), isNull(warehouseHeads.deletedAt)))
        .limit(1);

      if (!existing[0]) return false;

      await tx
        .update(warehouseHeads)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(warehouseHeads.id, headId));

      await tx
        .delete(userWarehouseRoles)
        .where(
          and(
            eq(userWarehouseRoles.userId, existing[0].userId),
            eq(userWarehouseRoles.warehouseId, existing[0].warehouseId)
          )
        );

      await tx
        .delete(userWarehouseMappings)
        .where(
          and(
            eq(userWarehouseMappings.userId, existing[0].userId),
            eq(userWarehouseMappings.warehouseId, existing[0].warehouseId)
          )
        );

      return true;
    });
  }
}
