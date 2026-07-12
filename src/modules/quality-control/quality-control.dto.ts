import { Static, Type } from "@sinclair/typebox";

export const QualityControlDetailDTO = Type.Object({
  goodsReceiptDetailId: Type.String({ format: "uuid" }),
  itemId: Type.String({ format: "uuid" }),
  passQuantity: Type.Integer({ minimum: 0 }),
  rejectQuantity: Type.Integer({ minimum: 0 }),
  rejectReason: Type.Optional(Type.String()),
});

export const CreateQualityControlDTO = Type.Object({
  goodsReceiptId: Type.String({ format: "uuid" }),
  inspectionDate: Type.String({ format: "date" }),
  notes: Type.Optional(Type.String()),
  details: Type.Array(QualityControlDetailDTO, { minItems: 1 }),
});

export const ApproveQualityControlDTO = Type.Object({
  remark: Type.Optional(Type.String()),
});

export const RejectQualityControlDTO = Type.Object({
  remark: Type.String({ minLength: 1 }),
});
