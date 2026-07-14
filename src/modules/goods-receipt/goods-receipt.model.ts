import { eq, desc, and, ilike, or, count, sql, isNull } from "drizzle-orm";
import { db } from "../../core/db";
import { goodsReceipts, goodsReceiptDetails } from "./goods-receipt.schema";
import { purchaseOrders, purchaseOrderDetails } from "../purchase-order/purchase-order.schema";
import { toGoodsReceiptDTO, type GoodsReceiptDTO } from "./goods-receipt.dto";
import type { CreateGoodsReceiptInput } from "./goods-receipt.validation";

async function generateGRCode(): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, ""); // YYYYMMDD
  const prefix = `GR-${dateStr}-`;

  const lastGR = await db.query.goodsReceipts.findFirst({
    where: ilike(goodsReceipts.code, `${prefix}%`),
    orderBy: [desc(goodsReceipts.code)],
  });

  let nextNum = 1;
  if (lastGR && lastGR.code) {
    const lastNumStr = lastGR.code.replace(prefix, "");
    const lastNum = parseInt(lastNumStr, 10);
    if (!isNaN(lastNum)) {
      nextNum = lastNum + 1;
    }
  }

  const paddedNum = nextNum.toString().padStart(4, "0");
  return `${prefix}${paddedNum}`;
}

export class GoodsReceiptModel {
  static async findAll(params: {
    page: number;
    limit: number;
    search?: string;
    filterColumn?: string;
    status?: number;
    warehouseId?: string;
    vendorId?: string;
  }) {
    const { page, limit, search, filterColumn, status, warehouseId, vendorId } = params;
    const offset = (page - 1) * limit;

    const conditions = [isNull(goodsReceipts.deletedAt)];

    if (search && filterColumn) {
      if (filterColumn === "code") conditions.push(ilike(goodsReceipts.code, `%${search}%`));
    } else if (search) {
      const searchCondition = or(
        ilike(goodsReceipts.code, `%${search}%`),
        ilike(goodsReceipts.deliveryNoteNumber, `%${search}%`)
      );
      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }

    if (status !== undefined) conditions.push(eq(goodsReceipts.status, status));
    if (warehouseId) conditions.push(eq(goodsReceipts.warehouseId, warehouseId));
    if (vendorId) conditions.push(eq(goodsReceipts.vendorId, vendorId));

    const whereClause = and(...conditions);

    const [data, totalCount] = await Promise.all([
      db.query.goodsReceipts.findMany({
        where: whereClause,
        limit,
        offset,
        orderBy: [desc(goodsReceipts.createdAt)],
        with: {
          purchaseOrder: true,
          vendor: true,
          warehouse: true,
        },
      }),
      db.select({ count: count() }).from(goodsReceipts).where(whereClause),
    ]);

    return {
      data: data.map(toGoodsReceiptDTO),
      total: totalCount[0]?.count ?? 0,
      page,
      limit,
      totalPages: Math.ceil(totalCount[0]?.count ?? 0 / limit),
    };
  }

  static async findById(id: string): Promise<GoodsReceiptDTO | undefined> {
    const result = await db.query.goodsReceipts.findFirst({
      where: and(eq(goodsReceipts.id, id), isNull(goodsReceipts.deletedAt)),
      with: {
        purchaseOrder: true,
        vendor: true,
        warehouse: true,
        details: {
          where: isNull(goodsReceiptDetails.deletedAt),
          with: {
            item: {
              with: { uom: true, category: true }
            },
            purchaseOrderDetail: true,
          }
        }
      }
    });

    return result ? toGoodsReceiptDTO(result) : undefined;
  }

  static async create(payload: CreateGoodsReceiptInput, userId: string): Promise<GoodsReceiptDTO | undefined> {
    const result = await db.transaction(async (tx) => {
      // 1. Verify PO exists and is approved
      const po = await tx.query.purchaseOrders.findFirst({
        where: and(eq(purchaseOrders.id, payload.purchaseOrderId), isNull(purchaseOrders.deletedAt))
      });
      if (!po) throw new Error("Purchase Order not found");
      if (po.status !== 2 && po.status !== 4 && po.status !== 5) {
        throw new Error(`PO cannot be received at current status: ${po.status}`);
      }

      // 2. Insert Header
      const code = await generateGRCode();
      const [gr] = await tx.insert(goodsReceipts).values({
        code,
        purchaseOrderId: payload.purchaseOrderId,
        vendorId: payload.vendorId,
        warehouseId: payload.warehouseId,
        receiptDate: payload.receiptDate,
        deliveryNoteNumber: payload.deliveryNoteNumber,
        description: payload.description,
        status: 1, // 1: Received / Pending QC
        createdBy: userId,
        updatedBy: userId,
      }).returning();

      if (!gr) throw new Error("Failed to create GR header");

      // 3. Insert Details and Update PO Details
      for (const detail of payload.details) {
        // Find PO Detail to validate remaining quantity
        const poDetail = await tx.query.purchaseOrderDetails.findFirst({
          where: and(eq(purchaseOrderDetails.id, detail.purchaseOrderDetailId), isNull(purchaseOrderDetails.deletedAt))
        });
        
        if (!poDetail) throw new Error(`PO Detail not found for item ${detail.itemId}`);
        
        // Allowed over-receive? We might just cap it or allow it depending on business logic.
        // For now, let's just log or accept the received quantity.

        await tx.insert(goodsReceiptDetails).values({
          goodsReceiptId: gr.id,
          purchaseOrderDetailId: detail.purchaseOrderDetailId,
          itemId: detail.itemId,
          receivedQuantity: detail.receivedQuantity,
          remark: detail.remark,
          createdBy: userId,
          updatedBy: userId,
        });

        // Update PO Detail's receivedQuantity
        const newReceivedQty = poDetail.receivedQuantity + detail.receivedQuantity;
        await tx.update(purchaseOrderDetails)
          .set({
            receivedQuantity: newReceivedQty,
            updatedAt: new Date(),
            updatedBy: userId,
          })
          .where(eq(purchaseOrderDetails.id, detail.purchaseOrderDetailId));
      }

      // 4. Update PO Status
      // Check all PO Details to see if fully received
      const allPoDetails = await tx.query.purchaseOrderDetails.findMany({
        where: and(eq(purchaseOrderDetails.purchaseOrderId, payload.purchaseOrderId), isNull(purchaseOrderDetails.deletedAt))
      });

      let allFullyReceived = true;
      let someReceived = false;

      for (const pd of allPoDetails) {
        if (pd.receivedQuantity > 0) someReceived = true;
        if (pd.receivedQuantity < pd.quantity) {
          allFullyReceived = false;
        }
      }

      let newPoStatus = po.status;
      if (allFullyReceived) newPoStatus = 6; // Fully Received
      else if (someReceived) newPoStatus = 5; // Partial Received

      if (newPoStatus !== po.status) {
        await tx.update(purchaseOrders)
          .set({ status: newPoStatus, updatedAt: new Date(), updatedBy: userId })
          .where(eq(purchaseOrders.id, po.id));
      }

      return gr;
    });

    return await this.findById(result.id);
  }
}
