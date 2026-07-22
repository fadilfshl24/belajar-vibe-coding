export function toGoodsReceiptDTO(gr: any) {
  return {
    id: gr.id,
    code: gr.code,
    purchaseOrderId: gr.purchaseOrderId,
    vendorId: gr.vendorId,
    warehouseId: gr.warehouseId,
    receiptDate: gr.receiptDate,
    deliveryNoteNumber: gr.deliveryNoteNumber,
    description: gr.description,
    status: gr.status,
    createdAt: gr.createdAt,
    updatedAt: gr.updatedAt,
    purchaseOrder: gr.purchaseOrder ? {
      id: gr.purchaseOrder.id,
      code: gr.purchaseOrder.code,
    } : undefined,
    vendor: gr.vendor ? {
      id: gr.vendor.id,
      name: gr.vendor.name,
      code: gr.vendor.code,
      email: gr.vendor.email,
      phone: gr.vendor.phone,
      address: gr.vendor.address,
    } : undefined,
    warehouse: gr.warehouse ? {
      ...gr.warehouse,
      id: gr.warehouse.id,
      name: gr.warehouse.name,
      code: gr.warehouse.code,
      address: gr.warehouse.address,
    } : undefined,
    details: gr.details ? gr.details.map((d: any) => ({
      id: d.id,
      goodsReceiptId: d.goodsReceiptId,
      purchaseOrderDetailId: d.purchaseOrderDetailId,
      itemId: d.itemId,
      receivedQuantity: Number(d.receivedQuantity),
      remark: d.remark,
      item: d.item ? {
        id: d.item.id,
        name: d.item.name,
        code: d.item.code,
        sku: d.item.sku,
        uom: d.item.uom ? {
          name: d.item.uom.name,
        } : undefined,
        category: d.item.category ? {
          name: d.item.category.name,
        } : undefined,
      } : undefined,
      purchaseOrderDetail: d.purchaseOrderDetail ? {
        id: d.purchaseOrderDetail.id,
        quantity: d.purchaseOrderDetail.quantity,
        receivedQuantity: d.purchaseOrderDetail.receivedQuantity,
        attachmentUrl: d.purchaseOrderDetail.attachmentUrl,
      } : undefined,
    })) : [],
  };
}

export type GoodsReceiptDTO = ReturnType<typeof toGoodsReceiptDTO>;
