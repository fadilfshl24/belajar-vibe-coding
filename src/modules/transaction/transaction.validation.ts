import { z } from "zod";

const transactionItemSchema = z.object({
  itemId: z.string().uuid("Invalid item ID"),
  quantity: z.number().positive("Quantity must be positive"),
});

export const createTransactionSchema = z.object({
  warehouseId: z.string().uuid("Invalid warehouse ID"),
  type: z.enum(["IN", "OUT"]),
  referenceNumber: z.string().min(1, "Reference number is required"),
  description: z.string().optional(),
  transactionDate: z.string().optional(),
  items: z.array(transactionItemSchema).min(1, "At least one item is required"),
});

export const cancelRequestSchema = z.object({
  remark: z.string().min(5, "Remark must be at least 5 characters"),
});

export const cancelApproveSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  responseRemark: z.string().optional(),
});

export const listQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  searchTerm: z.string().optional(),
  warehouseId: z.string().uuid().optional(),
  type: z.enum(["IN", "OUT"]).optional(),
  status: z.enum(["DRAFT", "COMPLETED", "CANCEL_PENDING", "CANCELLED"]).optional(),
});

export const parseCreateTransaction = (data: unknown) => createTransactionSchema.safeParse(data);
export const parseCancelRequest = (data: unknown) => cancelRequestSchema.safeParse(data);
export const parseCancelApprove = (data: unknown) => cancelApproveSchema.safeParse(data);
export const parseListQuery = (data: unknown) => listQuerySchema.safeParse(data);
